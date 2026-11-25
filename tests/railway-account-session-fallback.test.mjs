import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/api/base44Client.js", import.meta.url), "utf8",
).replace(/^import .*;\r?\n/gm, "")
  .replace("export const base44 =", "const base44 =");

function createHarness({ railwayStatus = 200, signedIn = true, firstPartyLinked = signedIn, sessionToken = 'existing-account-token', legacyGuestKey = '', legacyGuestConnected = false, railwayConnected = true } = {}) {
  const calls = { railway: [], native: [], verified: 0 };
  const client = {
    auth: {
      me: async () => {
        calls.verified += 1;
        if (!signedIn) throw new Error("No account session");
        return { id: "signed-in-account" };
      },
    },
    functions: {
      invoke: async (name, payload) => {
        calls.native.push({ name, payload });
        if (payload?.guest_device_key) {
          if (!legacyGuestConnected) {
            if (name === "realDebridAuth") {
              return { data: { connected: false, valid: false, provider: "legacy-guest" } };
            }
            const error = new Error("Legacy device is not connected");
            error.status = 401;
            throw error;
          }
          return { data: { connected: true, valid: true,
            provider: name === "realDebridAuth" ? "legacy-guest" : "native" } };
        }
        // The real Base44 functions check auth.me and refuse requests from
        // users without a valid account or a previously linked guest key.
        if (!firstPartyLinked) {
          const error = new Error("No authenticated Media God account");
          error.status = 401;
          throw error;
        }
        return { data: { connected: true, valid: true, provider: "native" } };
      },
    },
  };
  const globals = {
    createClient: () => client,
    appParams: { appId: "test", token: "", functionsVersion: "", appBaseUrl: "" },
    railwayDeviceToken: () => "d".repeat(64),
    readGuestDebridDeviceKey: () => legacyGuestKey,
    invokeIndependentMetadata: async () => ({data:{}}),
    invokeIndependentImdbResolver: async () => ({data:{}}),
    invokeIndependentAddonSources: async () => ({data:{}}),
    invokeIndependentPublicFeature: async () => ({data:{}}),
    searchAddonSourcesWithPublicFallback: async () => ({data:{}}),
    readAccountSessionToken: async () => sessionToken,
    INDEPENDENT_RD_FUNCTIONS: new Set(["realDebrid", "realDebridAuth", "multiDebrid", "findRdLibrary", "fetchAddonStreams"]),
    invokeIndependentRealDebrid: async (name, payload) => {
      calls.railway.push({name, payload});
      if (railwayStatus !== 200) {
        const error = new Error("Server rejected session");
        error.status = railwayStatus;
        throw error;
      }
      return { data: { connected: railwayConnected, valid: railwayConnected, provider: "railway" } };
    },
  };
  const result = vm.runInNewContext(source + "\nbase44;", globals, {
    filename: "base44Client.js",
  });
  return {client: result, calls};
}

test("Railway remains primary for a working Media God session", async()=>{
  await withIndependentSession("primary-test-session",async client=>{
    const calls=[];
    globalThis.fetch=async(url,init)=>{
      calls.push({url,init});
      return gatewayResponse(200,{connected:true,provider:"railway"});
    };
    assert.equal((await client.functions.invoke("realDebridAuth",{action:"status",guest_device_key:"must-not-forward"})).data.provider,"railway");
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,RD_API+"/functions/realDebridAuth");
    assert.equal(calls[0].init.headers.Authorization,"Bearer primary-test-session");
    assert.equal(calls[0].init.credentials,"omit");
    assert.deepEqual(JSON.parse(calls[0].init.body),{action:"status"});
  });
});

test("signed-in account keeps RD access when Railway rejects its token with 401", async () => {
  const {client, calls} = createHarness({railwayStatus:401});
  const payload = {action:"status"};
  const result = await client.functions.invoke("realDebridAuth", payload);
  assert.equal(result.data.provider, "native");
  assert.equal(calls.verified, 1);
  assert.equal(calls.railway.length, 1);
  assert.equal(calls.native.length, 1);
  assert.equal(calls.native[0].name, "realDebridAuth");
  assert.deepEqual(calls.native[0].payload, payload);
  await client.functions.invoke("realDebrid", {action:"torrent_info"});
  assert.equal(calls.railway.length, 1, "short-lived fallback should avoid retry storms");
  assert.equal(calls.native.length, 2);
});

test("a guest cannot turn Railway's 401 into an authenticated Base44 request", async () => {
  const {client, calls} = createHarness({railwayStatus:401,signedIn:false});
  await assert.rejects(
    client.functions.invoke("realDebrid", {action:"status"}),
    error => error.status === 401,
  );
  assert.ok(calls.native.every(c => c.name === "realDebridAuth"),
    "only first-party status verification may be attempted");
});

test("Railway 403 stays a permission denial, never an account fallback",async()=>{
  await withIndependentSession("forbidden-test-session",async client=>{
    let calls=0;
    globalThis.fetch=async(url)=>{assert.equal(url,RD_API+"/functions/realDebrid");calls++;return gatewayResponse(403,{error:"Forbidden"});};
    await assert.rejects(client.functions.invoke("realDebrid",{action:"status"}),error=>error.status===403);
    assert.equal(calls,1);
    assert.equal(client.auth.getAccessToken(),"forbidden-test-session");
  });
});

test("Railway 500 stays an upstream failure, not a false login problem",async()=>{
  await withIndependentSession("upstream-test-session",async client=>{
    let calls=0;
    globalThis.fetch=async(url)=>{assert.equal(url,RD_API+"/functions/realDebrid");calls++;return gatewayResponse(500,{error:"Upstream unavailable"});};
    await assert.rejects(client.functions.invoke("realDebrid",{action:"status"}),error=>error.status===500);
    assert.equal(calls,1);
    assert.equal(client.auth.getAccessToken(),"upstream-test-session");
  });
});

test("signed-in Base44 account without exported bearer token keeps its existing RD account", async () => {
  const { client, calls } = createHarness({sessionToken:"",signedIn:true});
  const result = await client.functions.invoke("realDebridAuth", {action:"status"});
  assert.equal(result.data.provider,"native");
  assert.equal(calls.native.length,1);
  assert.equal(calls.railway.length,0, "never impersonate an unrelated guest device");
  assert.equal(calls.verified,1);
});

test("real guests without an account session retain the isolated Railway device route", async () => {
  const { client, calls } = createHarness({sessionToken:"",signedIn:false});
  const result = await client.functions.invoke("realDebridAuth",{action:"status"});
  assert.equal(result.data.provider,"railway");
  assert.equal(calls.railway.length,1);
  assert.ok(calls.native.every(c => c.name === "realDebridAuth"));
});

test("previously connected Base44 guest survives Railway migration without a new login", async () => {
  const key = "a".repeat(64);
  const {client, calls} = createHarness({
    sessionToken:"", signedIn:false, legacyGuestKey:key, legacyGuestConnected:true,
    railwayConnected:false,
  });
  const status = await client.functions.invoke("realDebridAuth", {action:"status"});
  assert.equal(status.data.provider, "legacy-guest");
  assert.equal(calls.railway.length, 0, "do not try new empty Railway device storage");
  const play = await client.functions.invoke("realDebrid", {action:"resolve_best"});
  assert.equal(play.data.provider, "native");
  assert.equal(calls.native.at(-1).payload.guest_device_key, key);
  assert.equal(calls.native.at(-1).payload.action, "resolve_best");
  assert.equal(calls.railway.length, 0);
});

test("legacy device must prove a valid connection before source playback fallback", async () => {
  const {client, calls} = createHarness({
    sessionToken:"", signedIn:false, railwayStatus:401,
    legacyGuestKey:"b".repeat(64), legacyGuestConnected:false,
  });
  await assert.rejects(
    client.functions.invoke("realDebrid", {action:"resolve_best"}),
    error => error.status === 401,
  );
  assert.ok(calls.native.every(c => c.name === "realDebridAuth"));
  assert.equal(calls.railway.length,1);
});

test("Railway signed-in status with no saved RD link can recover an old guest link", async () => {
  const key = "c".repeat(64);
  const {client, calls} = createHarness({
    signedIn:true, legacyGuestKey:key, legacyGuestConnected:true,
    railwayConnected:false,
  });
  const status = await client.functions.invoke("realDebridAuth", {action:"status"});
  assert.equal(status.data.provider,"legacy-guest");
  assert.equal(calls.railway.length,1);
  const play = await client.functions.invoke("realDebrid", {action:"resolve_best"});
  assert.equal(play.data.provider,"native");
  assert.equal(calls.native.at(-1).payload.guest_device_key,key);
});

test("existing signed-in accounts are not sent a guest capability when no guest is linked", async () => {
  const {client, calls} = createHarness({signedIn:true, railwayStatus:401});
  await client.functions.invoke("realDebrid", {action:"status"});
  assert.equal(calls.native[0].payload.guest_device_key,undefined);
});

test("a first-party RD function can recover a verified existing account if User/me is out of sync", async () => {
  const {client, calls} = createHarness({
    signedIn:false,
    firstPartyLinked:true,
    railwayStatus:401,
  });
  const result = await client.functions.invoke("realDebridAuth",{action:"status"});
  assert.equal(result.data.provider,"native");
  assert.equal(calls.railway.length,1);
  assert.equal(calls.native.filter(c => c.name === "realDebridAuth").length,2);
  const playable = await client.functions.invoke("realDebrid",{action:"resolve_best"});
  assert.equal(playable.data.provider,"native");
  assert.equal(calls.railway.length,1,"recovered account does not repeat rejected Railway requests");
  assert.ok(calls.native.every(c => !c.payload?.guest_device_key));
});

test("failed Railway account verification does not flood the backend on subsequent requests",async()=>{
  await withIndependentSession("rejected-test-session",async client=>{
    const calls=[];
    globalThis.fetch=async(url,init)=>{
      assert.equal(url,RD_API+"/functions/realDebridAuth");
      calls.push(init.headers.Authorization);
      return calls.length===1?gatewayResponse(401,{error:"Sign in to your new Media God account"}):gatewayResponse(200,{connected:true});
    };
    const fire=()=>client.functions.invoke("realDebridAuth",{action:"status"});
    for(let i=0;i<9;i++)await assert.rejects(fire(),error=>error.status===401);
    assert.equal(calls.length,1,"rejected account must not repeatedly hit gateway");
    client.auth.setToken("replacement-test-session");
    assert.equal((await fire()).data.connected,true);
    assert.deepEqual(calls,["Bearer rejected-test-session","Bearer replacement-test-session"]);
  });
});

/* The independent session gateway replaces the former Base44 fallback.
 * Test the actual client module, not a VM containing the retired SDK. */
import {base44 as independentClient,RD_API} from "../src/api/base44Client.js";

async function withIndependentSession(token,run){
  const oldWindow=globalThis.window,oldFetch=globalThis.fetch;
  const values=new Map();
  globalThis.window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
  independentClient.auth.setToken(token);
  try{await run(independentClient);}finally{
    globalThis.fetch=oldFetch;
    if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
  }
}
const gatewayResponse=(status,data)=>({ok:status===200,status,json:async()=>data});

test("upstream provider 401 is not treated as an invalid Media God session",async()=>{
  await withIndependentSession("provider-test-session",async client=>{
    let calls=0;
    globalThis.fetch=async(url)=>{assert.equal(url,RD_API+"/functions/realDebridAuth");calls++;return gatewayResponse(401,{error:"Provider connection expired"});};
    for(let i=0;i<2;i++)await assert.rejects(client.functions.invoke("realDebridAuth",{action:"status"}),e=>e.status===401);
    assert.equal(calls,2);
  });
});
