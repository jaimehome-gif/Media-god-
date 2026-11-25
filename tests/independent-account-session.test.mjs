import test from "node:test";
import assert from "node:assert/strict";
import { base44, IDENTITY_API, RD_API } from "../src/api/base44Client.js";

// Exercise the real independent client, not the retired Base44 SDK shim.
// Every response is synthetic; no account credentials or live media are used.
function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}
async function withHarness(status, run) {
  const originals = Object.fromEntries(["window", "fetch"].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const calls = [];
  Object.defineProperty(globalThis, "window", {configurable: true, writable: true,
    value: {localStorage: storage(), sessionStorage: storage()}});
  globalThis.fetch = async (url, options = {}) => {
    calls.push({url: String(url), options});
    const publicRequest = !String(url).startsWith(RD_API) &&
      !String(url).startsWith(IDENTITY_API);
    const code = publicRequest ? 200 : status;
    return {ok: code >= 200 && code < 300, status: code,
      json: async () => publicRequest ? {streams: []} :
        code === 200 ? {connected: true} : {error: "Synthetic denial"}};
  };
  try { await run(calls); }
  finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test("independent private requests require a session and never send a guest capability", async () => {
  await withHarness(200, async calls => {
    for (const name of ["realDebrid", "realDebridAuth", "multiDebrid", "findRdLibrary"]) {
      await assert.rejects(base44.functions.invoke(name, {action:"status", guest_device_key:"synthetic"}),
        error => error.status === 401);
    }
    assert.equal(calls.length, 0);
  });
});

test("independent account requests use only the current bearer and strip guest identity", async () => {
  await withHarness(200, async calls => {
    base44.auth.setToken("synthetic-account-a");
    await base44.functions.invoke("realDebridAuth", {action:"status", guest_device_key:"other-device"});
    base44.auth.setToken("synthetic-account-b");
    await base44.functions.invoke("realDebridAuth", {action:"status"});
    assert.deepEqual(calls.map(c => c.options.headers.Authorization),
      ["Bearer synthetic-account-a", "Bearer synthetic-account-b"]);
    for (const call of calls) {
      assert.equal(call.url, RD_API + "/functions/realDebridAuth");
      assert.equal(call.options.credentials, "omit");
      assert.deepEqual(JSON.parse(call.options.body), {action:"status"});
    }
  });
});

for (const status of [401, 403, 500, 503]) {
  test("independent private HTTP " + status + " is propagated without fallback", async () => {
    await withHarness(status, async calls => {
      base44.auth.setToken("synthetic-account");
      await assert.rejects(base44.functions.invoke("realDebridAuth", {action:"status"}),
        error => error.status === status);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, RD_API + "/functions/realDebridAuth");
    });
  });
}

test("logout clears the session before any subsequent private request", async () => {
  await withHarness(200, async calls => {
    base44.auth.setToken("synthetic-account");
    await base44.auth.logout();
    assert.equal(base44.auth.getAccessToken(), "");
    await assert.rejects(base44.functions.invoke("realDebridAuth", {action:"status"}),
      error => error.status === 401);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, IDENTITY_API + "/auth/logout");
  });
});

test("public fallback sends only whitelisted title fields and no account bearer", async () => {
  await withHarness(403, async calls => {
    base44.auth.setToken("synthetic-account");
    await base44.functions.invoke("fetchAddonStreams", {
      title:"Synthetic media", imdb_id:"tt1234567",
      guest_device_key:"synthetic-guest", token:"synthetic-secret",
      private_addon_url:"https://example.invalid/private"
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, RD_API + "/functions/fetchAddonStreams");
    const publicCall = calls[1];
    assert.notEqual(publicCall.url, calls[0].url);
    assert.equal(publicCall.options.headers.Authorization, undefined);
    assert.equal(publicCall.options.credentials, "omit");
    assert.deepEqual(JSON.parse(publicCall.options.body), {imdb_id:"tt1234567", title:"Synthetic media"});
  });
});
