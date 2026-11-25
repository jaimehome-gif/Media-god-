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

test("website pauses after an upstream addMagnet 429 inside HTTP 200, including after reload", async t => {
  let now = 200000, calls = 0;
  const tab = new Map();
  const oldWindow = globalThis.window, oldLocation = globalThis.location;
  globalThis.location = {hostname:"www.underworldhub.co.uk"};
  globalThis.window = {
    localStorage:{getItem:()=>"wrapped-limit-session"},
    sessionStorage:{getItem:key=>tab.get(key),setItem:(key,value)=>tab.set(key,value)},
  };
  t.after(()=>{globalThis.window=oldWindow;globalThis.location=oldLocation;});
  t.mock.method(Date,"now",()=>now);
  t.mock.method(globalThis,"fetch",async()=>{
    calls++;
    return Response.json(calls === 1 ? {status:"failed",upstream_status:429,error:"Real-Debrid could not add this torrent (429): too_many_requests"} : {status:"ready"});
  });
  const lookup = client => client.functions.invoke("realDebrid",{action:"resolve_best"});
  await assert.rejects(lookup(base44),/rate limited.*60 seconds/);
  const fresh = (await import("../src/api/base44Client.js?reload-after-limit")).base44;
  now += 15000;
  await assert.rejects(lookup(fresh),/45 seconds/);
  assert.equal(calls,1);
  now += 45000;
  assert.equal((await lookup(fresh)).data.status,"ready");
  assert.equal(calls,2);
});
