import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  const client = {
    auth: {
      me: async () => {
        secondaryReads += 1;
        throw new Error("Base44 User/me briefly unavailable");
      },
      updateMe: async patch => ({...verifiedUser,...patch}),
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
  assert.equal(scoped.auth.updateMe,client.auth.updateMe,
    "keep original user-scoped credential update");
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

test("Railway RD service requires a real Base44 session, protects actions and excludes guest impersonation", () => {
  const server = source("deploy/media-god-rd-api/server.mjs");
  assert.match(server, /createAccountVerificationCache\(/);
  assert.match(server, /const verifiedClient = createAccountVerificationCache/);
  assert.match(server, /if \(!verified\) \{/);
  assert.match(server, /return respond\(res, 401, \{error: "Sign in to Media God to use Real-Debrid\."\}/);
  assert.match(server, /credentials must not be supplied/i);
  assert.match(server, /ALLOWED_ORIGINS/);
  assert.match(server, /private, no-store/);
  assert.match(server, /\/functions\/realDebridAuth/);
  assert.match(server, /\/functions\/findRdLibrary/);
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

test("client redirects all main RD actions and cached-source checks to verified backend", () => {
  const client = source("src/api/base44Client.js");
  const helper = source("src/api/independentRealDebrid.js");
  assert.match(client, /INDEPENDENT_RD_FUNCTIONS\.has\(String\(name \|\| ''\)\)/);
  assert.match(client, /readAccountSessionToken\(\)/);
  assert.match(client, /invokeIndependentRealDebrid\(name, payload, \{ token: sessionToken \}\)/);
  for (const name of ["realDebrid", "realDebridAuth", "findRdLibrary", "multiDebrid"]) {
    assert.match(helper, new RegExp('"' + name + '"'));
  }
  assert.match(helper, /getAccessToken/);
  assert.match(helper, /credentials: "omit"/);
  assert.match(helper, /"Authorization": deviceToken \? `Device/);
  assert.match(helper, /`Bearer \$\{session\}`/);
  assert.doesNotMatch(helper, /localStorage\.setItem|process\.env/);
  const server = source("deploy/media-god-rd-api/server.mjs");
  assert.match(server, /"\/functions\/multiDebrid": multiDebrid/);
});

test("Railway Dockerfile packages every local Real-Debrid server import", () => {
  const server = source("deploy/media-god-rd-api/server.mjs");
  const dockerfile = source("deploy/media-god-rd-api/Dockerfile");
  const localModules = [...server.matchAll(/from ["']\.\/([^"']+)["']/g)]
    .map(match => match[1]);
  assert.ok(localModules.includes("accountVerificationCache.mjs"));
  for (const filename of localModules) {
    assert.ok(dockerfile.includes(filename),
      "Railway Dockerfile must copy " + filename);
  }
});


test("expiring RD credentials refresh before normal playback and update the verified cache", async () => {
  const previousFetch = globalThis.fetch;
  const user = {
    id: "refresh-before-play",
    rd_token: "expired-rd-access",
    rd_refresh_token: "old-rd-refresh",
    rd_client_id: "client-id",
    rd_client_secret: "client-secret",
    rd_token_expires_at: "2020-01-01T00:00:00Z",
  };
  const seen = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      seen.push({target, authorization: options.headers?.Authorization || ""});
      if (target.includes("/oauth/v2/token")) {
        return Response.json({access_token:"new-rd-access", refresh_token:"new-rd-refresh", expires_in:3600});
      }
      if (target.endsWith("/rest/1.0/user")) {
        return Response.json({premium:1, points:20});
      }
      return Response.json({error:"Unexpected test URL"}, {status:500});
    };
    const res = await realDebrid(request("status", user));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).valid, true);
    assert.equal(user.rd_token, "new-rd-access", "successful refresh must update cached verified user");
    assert.equal(user.rd_refresh_token, "new-rd-refresh");
    assert.ok(seen.some(entry => entry.authorization === "Bearer new-rd-access"));
    assert.ok(!seen.some(entry => entry.authorization === "Bearer expired-rd-access"));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("RD bad_token during addMagnet refreshes and retries the exact magnet only once", async () => {
  const previousFetch = globalThis.fetch;
  const user = {
    id: "refresh-on-bad-token",
    rd_token: "revoked-rd-access",
    rd_refresh_token: "refresh-secret",
    rd_client_id: "client-id",
    rd_client_secret: "client-secret",
    rd_token_expires_at: "2030-01-01T00:00:00Z",
  };
  const magnet = "magnet:?xt=urn:btih:0123456789012345678901234567890123456789";
  const usedTokens = [];
  let oauthCount = 0;
  try {
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.includes("/oauth/v2/token")) {
        oauthCount += 1;
        return Response.json({access_token:"recovered-rd-access", refresh_token:"refresh-rotated", expires_in:3600});
      }
      if (target.endsWith("/torrents/addMagnet")) {
        usedTokens.push(options.headers?.Authorization);
        if (options.headers?.Authorization === "Bearer revoked-rd-access") {
          return Response.json({error:"bad_token"}, {status:401});
        }
        return Response.json({id:"new-rd-torrent"});
      }
      if (target.includes("/torrents/info/new-rd-torrent")) {
        return Response.json({id:"new-rd-torrent",status:"magnet_conversion",files:[],links:[]});
      }
      return Response.json({error:"Unexpected test URL"}, {status:500});
    };
    const res = await realDebrid(request("add_magnet", user, {body:{magnet}}));
    const payload = await res.json();
    assert.equal(res.status, 200);
    assert.notEqual(payload.error_code, "RD_CREDENTIAL_EXPIRED");
    assert.deepEqual(usedTokens, ["Bearer revoked-rd-access", "Bearer recovered-rd-access"]);
    assert.equal(oauthCount, 1);
    assert.equal(user.rd_token, "recovered-rd-access");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("RD bad_token with no refresh credential stops source-cycling and protects the account", async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({error:"bad_token"}, {status:401});
    const user = {id:"missing-refresh",rd_token:"revoked",rd_refresh_token:""};
    const res = await realDebrid(request("add_magnet", user, {
      body:{magnet:"magnet:?xt=urn:btih:0123456789012345678901234567890123456789"},
    }));
    const payload = await res.json();
    assert.equal(res.status, 200);
    assert.equal(payload.status, "failed");
    assert.equal(payload.error_code, "RD_CREDENTIAL_EXPIRED");
    assert.match(payload.error, /Reconnect Real-Debrid in Settings/);
    assert.equal(user.rd_token, "revoked", "never delete credentials after an auth failure");
    const transient = source("src/components/mg/realDebridTransientFailure.js");
    assert.match(transient, /"RD_CREDENTIAL_EXPIRED"/);
    assert.match(transient, /selected source has not been marked bad/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
