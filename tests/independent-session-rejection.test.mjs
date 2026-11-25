import test from "node:test";
import assert from "node:assert/strict";
import { base44, RD_API } from "../src/api/base44Client.js";

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test("verified session rejection is bounded, account-specific, and never triggered by a provider denial", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 100000;
  const calls = [];
  let reply = {status:401, data:{code:"MG_SESSION_REJECTED",error:"Synthetic identity denial"}};
  Object.defineProperty(globalThis,"window",{configurable:true,writable:true,
    value:{localStorage:storage(),sessionStorage:storage()}});
  Date.now = () => now;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith(RD_API + "/functions/"));
    calls.push({url, authorization:options.headers.Authorization});
    return {status:reply.status,ok:reply.status===200,json:async()=>reply.data};
  };
  const status = () => base44.functions.invoke("realDebridAuth",{action:"status"});
  try {
    base44.auth.setToken("synthetic-account-a");
    await assert.rejects(status(), e=>e.status===401 && e.code==="MG_SESSION_REJECTED");
    for(let i=0;i<8;i++) await assert.rejects(status(), e=>e.code==="MG_SESSION_REJECTED");
    assert.equal(calls.length,1);
    assert.equal(base44.auth.getAccessToken(),"synthetic-account-a");
    reply={status:200,data:{connected:true}};
    now+=10001;
    assert.equal((await status()).data.connected,true);
    assert.equal(calls.length,2);
    reply={status:401,data:{code:"MG_SESSION_REJECTED"}};
    await assert.rejects(status(),e=>e.code==="MG_SESSION_REJECTED");
    base44.auth.setToken("synthetic-account-b");
    reply={status:200,data:{connected:true}};
    await status();
    assert.equal(calls.at(-1).authorization,"Bearer synthetic-account-b");
    assert.equal(calls.length,4);
    reply={status:401,data:{error:"Synthetic provider denial"}};
    await assert.rejects(status(),e=>e.status===401);
    reply={status:200,data:{connected:true}};
    await status();
    assert.equal(calls.length,6,"provider denial must not start a session rejection hold");
  } finally {
    base44.auth.setToken("");
    Date.now=originalNow;
    globalThis.fetch=originalFetch;
    if(originalWindow) Object.defineProperty(globalThis,"window",originalWindow);
    else delete globalThis.window;
  }
});
