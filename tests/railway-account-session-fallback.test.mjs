import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/api/base44Client.js", import.meta.url), "utf8",
).replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];/gm, "")
  .replace(/^export\s+/gm, "");

function createHarness({ status = 200, token = "verified-account-token", connected = true } = {}) {
  const requests = [];
  const storage = new Map(token ? [["mg:jaime-home-session:v1", token]] : []);
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  const globals = {
    window: { localStorage },
    AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, method: options.method, headers: options.headers,
        body: options.body ? JSON.parse(options.body) : undefined });
      return {
        ok: status >= 200 && status < 300, status,
        headers: { get: () => null },
        json: async () => status === 200
          ? { connected, valid: connected, provider: "railway" }
          : { error: "Request rejected" },
      };
    },
  };
  const client = vm.runInNewContext(source + "\nbase44;", globals,
    { filename: "base44Client.js" });
  return { client, requests };
}

const isStatus = status => error => error.status === status;
const gateway = "https://media-god-rd-independent-api-production.up.railway.app";
const privateFunctions = ["realDebrid", "realDebridAuth", "multiDebrid", "findRdLibrary"];

test("Railway is the only private account gateway for an independent session", async () => {
  const {client, requests} = createHarness();
  const result = await client.functions.invoke("realDebridAuth", {action:"status"});
  assert.equal(result.data.provider, "railway");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, gateway + "/functions/realDebridAuth");
  assert.equal(requests[0].headers.Authorization, "Bearer verified-account-token");
});

for (const status of [401, 403, 500]) {
  test("Railway " + status + " remains an error without legacy account fallback", async () => {
    const {client, requests} = createHarness({status});
    await assert.rejects(client.functions.invoke("realDebridAuth", {action:"status"}), isStatus(status));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, gateway + "/functions/realDebridAuth");
  });
}

for (const name of privateFunctions) {
  test("signed-out users cannot call " + name, async () => {
    const {client, requests} = createHarness({token:""});
    await assert.rejects(client.functions.invoke(name, {action:"status"}), isStatus(401));
    assert.equal(requests.length, 0);
  });
}

test("legacy guest capability cannot substitute for an independent session", async () => {
  const {client, requests} = createHarness({token:""});
  await assert.rejects(client.functions.invoke("realDebridAuth",
    {action:"status", guest_device_key:"a".repeat(64)}), isStatus(401));
  assert.equal(requests.length, 0);
});

test("private requests never forward legacy guest credentials", async () => {
  const {client, requests} = createHarness();
  await client.functions.invoke("realDebridAuth", {action:"status", guest_device_key:"b".repeat(64)});
  assert.equal(requests[0].body.guest_device_key, undefined);
  assert.equal(requests[0].body.action, "status");
  assert.equal(requests[0].headers.Authorization, "Bearer verified-account-token");
});

test("an unlinked independent account stays unlinked rather than falling back", async () => {
  const {client, requests} = createHarness({connected:false});
  const result = await client.functions.invoke("realDebridAuth", {action:"status"});
  assert.equal(result.data.connected, false);
  assert.equal(requests.length, 1);
});

test("a gateway 429 prevents repeated requests within the same account session", async () => {
  const {client, requests} = createHarness({status:429});
  for (let index=0;index<8;index++) {
    await assert.rejects(client.functions.invoke("realDebrid", {action:"status"}), isStatus(429));
  }
  assert.equal(requests.length, 1);
});

test("failed account verification must not flood the backend on subsequent requests", async () => {
  const {client, requests} = createHarness({status:401});
  for (let index=0;index<8;index++) {
    await assert.rejects(client.functions.invoke("realDebrid", {action:"status"}), isStatus(401));
  }
  assert.equal(requests.length, 1, "authentication failures must not be retried for every candidate");
});


test("a rejected session does not suppress a different newly signed-in session", async () => {
  const {client, requests} = createHarness({status:401});
  await assert.rejects(client.functions.invoke("realDebridAuth", {action:"status"}), isStatus(401));
  await assert.rejects(client.functions.invoke("realDebridAuth", {action:"status"}), isStatus(401));
  assert.equal(requests.length, 1);
  client.auth.setToken("new-account-token");
  await assert.rejects(client.functions.invoke("realDebridAuth", {action:"status"}), isStatus(401));
  assert.equal(requests.length, 2);
  assert.equal(requests[1].headers.Authorization, "Bearer new-account-token");
});
