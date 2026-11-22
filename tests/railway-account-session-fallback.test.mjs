import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/api/base44Client.js", import.meta.url), "utf8",
).replace(/^import .*;\r?\n/gm, "")
  .replace("export const base44 =", "const base44 =");

function createHarness({ railwayStatus = 200, signedIn = true, sessionToken = 'existing-account-token' } = {}) {
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
        return { data: { connected: true, provider: "native" } };
      },
    },
  };
  const globals = {
    createClient: () => client,
    appParams: { appId: "test", token: "", functionsVersion: "", appBaseUrl: "" },
    railwayDeviceToken: () => "d".repeat(64),
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
      return { data: { connected: true, provider: "railway" } };
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
  assert.equal(calls.native.length, 0);
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
  assert.equal(calls.native.length,0);
});
