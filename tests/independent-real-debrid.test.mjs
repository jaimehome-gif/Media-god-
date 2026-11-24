import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import vm from "node:vm";
import realDebrid from "../deploy/media-god-rd-api/realDebrid.mjs";
import realDebridAuth from "../deploy/media-god-rd-api/realDebridAuth.mjs";
import multiDebrid from "../deploy/media-god-rd-api/multiDebrid.mjs";
import { createClientFromRequest } from "../deploy/media-god-rd-api/verifiedUserClient.mjs";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

function request(action, user, { body = {} } = {}) {
  const req = new Request("https://local.test/functions/realDebrid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const client = {
    auth: {
      me: async () => user,
      updateMe: async patch => ({...user, ...patch}),
    },
    entities: {
      RdLink: {
        filter: async () => [],
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => ({}),
      },
    },
  };
  Object.defineProperties(req, {
    __mediaGodVerifiedClient: {value: client},
    __mediaGodVerifiedUser: {value: user},
    __mediaGodVerifiedUserId: {value: user.id},
  });
  return req;
}

test("the ported RD status uses the verified account token, not a client-supplied one", async () => {
  const original = globalThis.fetch;
  const seen = [];
  try {
    globalThis.fetch = async (url, options) => {
      seen.push({url: String(url), authorization: options?.headers?.Authorization || ""});
      return new Response(JSON.stringify({premium: 1, points: 100, expiration: "2030-01-01"}), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    };
    const res = await realDebrid(request("status", {id:"verified-1", rd_token:"correct-private-rd-token"}, {
      body: {rd_token:"attacker-fake-token"},
    }));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.valid, true);
    assert.equal(data.premium, true);
    assert.ok(seen.some(call => call.authorization === "Bearer correct-private-rd-token"));
    assert.ok(!seen.some(call => call.authorization.includes("attacker-fake-token")));
    assert.doesNotMatch(JSON.stringify(data), /correct-private-rd-token|attacker-fake-token/);
  } finally {
    globalThis.fetch = original;
  }
});

test("Real-Debrid authentication status remains account-scoped and never exposes tokens", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      premium: 1, points: 23, expiration: "2030-01-01",
    }), {status: 200, headers: {"Content-Type":"application/json"}});
    const res = await realDebridAuth(request("status", {
      id: "verified-2",
      rd_token: "secret-token",
      rd_refresh_token: "secret-refresh",
    }));
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.connected, true);
    assert.doesNotMatch(JSON.stringify(payload), /secret-token|secret-refresh/);
  } finally {
    globalThis.fetch = original;
  }
});

test("handlers cannot obtain a client without a verified user request", () => {
  const request = new Request("https://local.test", {method:"POST"});
  assert.throws(() => createClientFromRequest(request), /Verified Media God account/);
});

test("a verified account is stable inside its RD handler despite a second User/me outage", async () => {
  const verifiedUser = {id:"verified-stable",rd_token:"private-real-debrid-token"};
  let secondaryReads = 0;
  let credentialWrites = 0;
  const client = {
    auth: {
      me: async () => {
        secondaryReads += 1;
        throw new Error("Base44 User/me briefly unavailable");
      },
      updateMe: async patch => {
        credentialWrites++;
        return {...verifiedUser,...patch};
      },
    },
    entities: {RdLink:{filter:async()=>[]}},
  };
  const req = new Request("https://local.test/functions/realDebrid", {
    method: "POST",
    body: JSON.stringify({action:"status"}),
    headers: {"Content-Type":"application/json"},
  });
  Object.defineProperties(req, {
    __mediaGodVerifiedClient: {value:client},
    __mediaGodVerifiedUser: {value:verifiedUser},
    __mediaGodVerifiedUserId: {value:verifiedUser.id},
  });
  const scoped = createClientFromRequest(req);
  assert.notEqual(scoped,client);
  assert.deepEqual(await scoped.auth.me(),verifiedUser);
  assert.equal(secondaryReads,0,"never repeat authentication after server verification");
  const saved = await scoped.auth.updateMe({rd_token:"replacement-test-token"});
  assert.equal(credentialWrites,1,"delegate to the verified account store");
  assert.deepEqual(await scoped.auth.me(),saved,"subsequent checks see the completed write");
  assert.equal(secondaryReads,0);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({premium:1}), {
      status:200,headers:{"Content-Type":"application/json"},
    });
    const result = await realDebrid(req);
    assert.equal(result.status,200);
    assert.equal((await result.json()).valid,true);
    assert.equal(secondaryReads,0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mismatched verified-user IDs never gain an authenticated RD client", () => {
  const client = {auth:{me:async()=>({id:"actual-user"})}};
  const req = new Request("https://local.test", {method:"POST"});
  Object.defineProperties(req, {
    __mediaGodVerifiedClient: {value:client},
    __mediaGodVerifiedUser: {value:{id:"attacker"}},
    __mediaGodVerifiedUserId: {value:"another-user"},
  });
  assert.throws(() => createClientFromRequest(req), /Verified Media God account/);
});

test("Railway RD service requires a verified account, protects actions and excludes guest impersonation", async () => {
  const server = source("deploy/media-god-rd-api/server.mjs")
    .replace(/^import .*;$/gm, "")
    .split("http.createServer(")[0];
  const id = "11111111-1111-4111-8111-111111111111";
  const token = "A".repeat(40);
  const calls = [];
  let verifiedStoreId = "account-store";
  const handler = async req => {
    calls.push(req.__mediaGodVerifiedUserId);
    return Response.json({ok:true});
  };
  const serve = vm.runInNewContext(server + "\nserve", {
    process: {env: {IDENTITY_VERIFY_URL:"https://identity.invalid/auth/me",
      RD_ACCOUNT_DERIVATION_KEY:"synthetic-secret-".repeat(4)}},
    createHash, createHmac, AbortSignal, Request, Buffer, console,
    realDebrid: handler, realDebridAuth: handler, findRdLibrary: handler,
    multiDebrid: handler, fetchAddonStreams: handler,
    fetch: async (_url, options) => options.headers.Authorization === "Bearer " + token
      ? Response.json({id}) : new Response(null,{status:401}),
    deviceClient: async () => ({user:{id:"account-store"},client:{auth:{me:async()=>({id:verifiedStoreId})}}}),
  });
  async function requestServer(authorization, body = {}, origin = "https://underworldhub.co.uk") {
    const request = {headers:{authorization,origin},url:"/functions/realDebridAuth",method:"POST",
      async *[Symbol.asyncIterator]() {yield Buffer.from(JSON.stringify(body));}};
    const headers = {};
    const reply = {setHeader:(key,value)=>{headers[key]=value;},
      writeHead(status){this.status=status;},end(value){this.body=value;}};
    await serve(request,reply);
    return {status:reply.status,headers,body:JSON.parse(reply.body)};
  }
  for (const authorization of ["", "Device " + token, "Bearer " + "B".repeat(40)]) {
    assert.equal((await requestServer(authorization)).status,401);
  }
  for (const body of [{user_id:"other"}, {guest_device_key:"other"}, {rd_token:"other"}, {rd_client_id:"other"}]) {
    assert.equal((await requestServer("Bearer " + token,body)).status,400);
  }
  assert.equal((await requestServer("Bearer " + token,{}, "https://untrusted.invalid")).status,403);
  assert.equal(calls.length,0);
  const accepted = await requestServer("Bearer " + token,{action:"status"});
  assert.equal(accepted.status,200);
  assert.equal(accepted.headers["Cache-Control"],"private,no-store");
  assert.deepEqual(calls,["account-store"]);
  verifiedStoreId = "another-account";
  assert.equal((await requestServer("Bearer " + token,{action:"status"})).status,401);
  assert.deepEqual(calls,["account-store"], "Mismatched account must never reach a handler");
  const guests = source("deploy/media-god-rd-api/guestDebrid.mjs");
  assert.doesNotMatch(guests, /asServiceRole|process\.env\..*TOKEN/);
});

test("authenticated Real-Debrid cache-check route returns valid structures", async () => {
  const user = {id:"verified-cache", rd_token:"private-dummy-rd", debrid_provider_priority:["realdebrid"]};
  const res = await multiDebrid(request("check_cache", user, {body:{hashes:[]}}));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.cached, {});
  assert.deepEqual(data.bestProviderByHash, {});
});

function privateFacadeHarness(fetch, publicLookup = async () => { throw new Error("Unexpected public lookup"); }) {
  let token = "synthetic-session-A";
  const localStorage = {getItem:()=>token,setItem:(_key,value)=>{token=value;},removeItem:()=>{token="";}};
  const code = source("src/api/base44Client.js")
    .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];/gm, "")
    .replace(/^export\s+/gm, "");
  return vm.runInNewContext(code + "\nbase44;", {
    window:{localStorage}, fetch, AbortController, setTimeout, clearTimeout,
    invokeIndependentAddonSources: publicLookup,
  });
}

test("client redirects all main RD actions and cached-source checks to verified backend", async () => {
  const seen = [];
  const client = privateFacadeHarness(async (url, options) => {
    seen.push({url,options});
    return Response.json({valid:true});
  });
  for (const name of ["realDebrid", "realDebridAuth", "findRdLibrary", "multiDebrid"]) {
    const action = name === "multiDebrid" ? "check_cache" : "status";
    const result = await client.functions.invoke(name,{action,guest_device_key:"obsolete-guest"});
    assert.equal(result.data.valid,true);
    const {url,options} = seen.at(-1);
    assert.equal(url,"https://media-god-rd-independent-api-production.up.railway.app/functions/"+name);
    assert.equal(options.headers.Authorization,"Bearer synthetic-session-A");
    assert.equal(options.credentials,"omit");
    assert.equal(JSON.parse(options.body).action,action);
    assert.doesNotMatch(options.body,/obsolete-guest/);
  }
  client.auth.setToken("");
  await assert.rejects(client.functions.invoke("realDebrid",{action:"status"}),error=>error.status===401);
  assert.equal(seen.length,4);
});

test("late private responses cannot enter a different signed-in account", async () => {
  let release;
  const pending = new Promise(resolve=>{release=resolve;});
  const client = privateFacadeHarness(async()=>pending);
  const request = client.functions.invoke("realDebrid",{action:"status"});
  client.auth.setToken("synthetic-session-B");
  release(Response.json({valid:true}));
  await assert.rejects(request,error=>error.code==="SESSION_CHANGED");
  assert.equal(client.auth.getAccessToken(),"synthetic-session-B");
});

test("Railway Dockerfile packages every local Real-Debrid server import", () => {
  const server = source("deploy/media-god-rd-api/server.mjs");
  const dockerfile = source("deploy/media-god-rd-api/Dockerfile");
  const visited = new Set();
  const inspect = code => {
    const localModules = [...code.matchAll(/from ["']\.\/([^"']+)["']/g)]
      .map(match => match[1]);
    for (const filename of localModules) {
      if (visited.has(filename)) continue;
      visited.add(filename);
      assert.ok(dockerfile.includes(filename),
        "Railway Dockerfile must copy " + filename);
      inspect(source("deploy/media-god-rd-api/" + filename));
    }
  };
  inspect(server);
  assert.ok(visited.has("deviceClient.mjs"), "Verified account client must be packaged");
  assert.ok(visited.has("verifiedUserClient.mjs"), "Verified request helper must be packaged");
});


test("authenticated addon actions never degrade into anonymous discovery", async () => {
  for (const status of [401, 403, 429, 503]) {
    let privateCalls = 0, publicCalls = 0;
    const client = privateFacadeHarness(async (url, options) => {
      privateCalls++;
      assert.equal(url, "https://media-god-rd-independent-api-production.up.railway.app/functions/fetchAddonStreams");
      assert.equal(options.headers.Authorization, "Bearer synthetic-session-A");
      assert.equal(JSON.parse(options.body).action, "health");
      return Response.json({error:"Unavailable"}, {status});
    }, async () => { publicCalls++; return {data:{streams:[]}}; });
    await assert.rejects(client.functions.invoke("fetchAddonStreams",{action:"health"}), error=>error.status===status);
    client.auth.setToken("");
    await assert.rejects(client.functions.invoke("fetchAddonStreams",{action:"health"}), error=>error.status===401);
    assert.equal(privateCalls,1);
    assert.equal(publicCalls,0);
    await client.functions.invoke("fetchAddonStreams",{media_type:"movie",imdb_id:"tt0000001"});
    assert.equal(publicCalls,1);
  }
});
