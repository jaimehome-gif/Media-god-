import test from "node:test";
import assert from "node:assert/strict";
import {base44} from "../src/api/base44Client.js";

test("repeated source choices honour the gateway cooldown and allow a later retry", async t => {
  let now = 100000;
  let calls = 0;
  t.mock.method(Date, "now", () => now);
  const previous = globalThis.window;
  globalThis.window = {localStorage: {getItem: () => "test-session"}};
  t.after(() => { globalThis.window = previous; });
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1
      ? new Response("{}", {status: 429, headers: {"Retry-After": "12"}})
      : new Response("{}");
  });
  const lookup = () => base44.functions.invoke("realDebrid", {action:"resolve"});
  await assert.rejects(lookup, {status:429});
  await assert.rejects(lookup, /12 seconds/);
  assert.equal(calls, 1);
  now += 12001;
  await lookup();
  assert.equal(calls, 2);
});
