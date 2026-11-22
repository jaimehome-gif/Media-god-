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

test("Railway remains primary for a working Media God session", async () => {
  const {client, calls} = createHarness();
  const result = await client.functions.invoke("realDebridAuth", {action:"status"});
  assert.equal(result.data.provider, "railway");
  assert.equal(calls.railway.length, 1);
  assert.equal(calls.native.length, 0);
  assert.equal(calls.verified, 0);
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

test("Railway 403 stays a permission denial, never an account fallback", async () => {
  const {client, calls} = createHarness({railwayStatus:403});
  await assert.rejects(
    client.functions.invoke("realDebrid", {action:"status"}),
    error => error.status === 403,
  );
  assert.equal(calls.native.length, 0);
  assert.equal(calls.verified, 0);
});

test("Railway 500 stays an upstream failure, not a false login problem", async () => {
  const {client, calls} = createHarness({railwayStatus:500});
  await assert.rejects(
    client.functions.invoke("realDebrid", {action:"status"}),
    error => error.status === 500,
  );
  assert.equal(calls.native.length, 0);
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

test("failed Railway account verification does not flood the backend on subsequent requests", async () => {
  const {client, calls} = createHarness({
    signedIn:false,
    firstPartyLinked:false,
    railwayStatus:401,
  });
  const fire = () => client.functions.invoke("realDebrid",{action:"resolve_best"});
  await assert.rejects(fire(), error => error.status === 401);
  const firstCount = calls.railway.length;
  for (let index=0;index<8;index++) {
    await assert.rejects(fire(), error => error.status === 401);
  }
  assert.equal(firstCount,1);
  assert.equal(calls.railway.length,1,"authentication failures must not be retried for every candidate");
  assert.ok(calls.native.every(c => c.name === "realDebridAuth"),
    "no unverified guest or account can invoke RD resolution in Base44");
});
