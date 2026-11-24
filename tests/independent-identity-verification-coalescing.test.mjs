import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import vm from "node:vm";

const source = readFileSync(new URL("../deploy/media-god-rd-api/server.mjs", import.meta.url), "utf8");
const start = source.indexOf("const verificationPending = new Map();");
const end = source.indexOf("async function exclusive(", start);
assert.ok(start >= 0 && end > start);
const tokenA = "A".repeat(40), tokenB = "B".repeat(40);
const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";
const response = id => ({ ok: true, status: 200, json: async () => ({ id }) });
function makeVerifier(fetch) {
  const context = {
    fetch, createHash, createHmac, AbortSignal,
    VERIFY_URL: "https://identity.invalid/auth/me",
    ACCOUNT_KEY: "synthetic-test-secret-only".repeat(2),
    deviceClient: async capability => ({ capability }),
  };
  return vm.runInNewContext(source.slice(start, end) + "\nverifyIdentity", context);
}

test("concurrent requests for one session share only the in-flight verification", async () => {
  let calls = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  const verify = makeVerifier(async () => { calls++; return pending; });
  const a = verify("Bearer " + tokenA);
  const b = verify("Bearer " + tokenA);
  assert.equal(calls, 1);
  release(response(idA));
  const [first, second] = await Promise.all([a, b]);
  assert.equal(first.capability, second.capability);
  assert.notEqual(first, second);
  await verify("Bearer " + tokenA);
  assert.equal(calls, 2);
});

test("concurrent accounts remain isolated", async () => {
  let calls = 0;
  const verify = makeVerifier(async (_url, options) => {
    calls++;
    return response(options.headers.Authorization === "Bearer " + tokenA ? idA : idB);
  });
  const [first, second] = await Promise.all([verify("Bearer " + tokenA), verify("Bearer " + tokenB)]);
  assert.equal(calls, 2);
  assert.notEqual(first.capability, second.capability);
});

test("revoked sessions are rejected after a successful verification", async () => {
  let calls = 0;
  const verify = makeVerifier(async () => ++calls === 1 ? response(idA) : ({ ok: false, status: 401 }));
  assert.ok(await verify("Bearer " + tokenA));
  assert.equal(await verify("Bearer " + tokenA), null);
  assert.equal(calls, 2);
});

test("invalid bearer and temporary verifier outages never grant account access", async () => {
  let calls = 0;
  const verify = makeVerifier(async () => ++calls === 1 ? ({ ok: false, status: 503 }) : response(idA));
  assert.equal(await verify("Device " + tokenA), null);
  assert.equal(calls, 0);
  await assert.rejects(verify("Bearer " + tokenA), /temporarily unavailable/);
  assert.ok(await verify("Bearer " + tokenA));
  assert.equal(calls, 2);
});
