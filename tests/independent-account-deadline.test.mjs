import test from "node:test";
import assert from "node:assert/strict";
import {base44,IDENTITY_API} from "../src/api/base44Client.js";

async function isolated(run) {
  const priorWindow=globalThis.window, priorFetch=globalThis.fetch;
  const values=new Map();
  globalThis.window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
  try { await run(); }
  finally {
    globalThis.fetch=priorFetch;
    if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;
  }
}
const ok = data => ({ok:true,status:200,json:async()=>data});

test("independent account requests time out even if the WebView ignores abort",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});
  await isolated(async()=>{
    let signal,finish;
    globalThis.fetch=async(url,init)=>{
      assert.equal(url,IDENTITY_API+"/auth/config");
      signal=init.signal;
      return new Promise(resolve=>{finish=resolve;});
    };
    const pending=base44.auth.getRegistrationConfig();
    const failure=assert.rejects(pending,e=>e.code==="NETWORK_TIMEOUT");
    t.mock.timers.tick(8000);
    await failure;
    assert.equal(signal.aborted,true);
    finish(ok({registration:true}));
  });
});

test("a stalled response body also respects the account deadline",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});
  await isolated(async()=>{
    let finish,signal;
    globalThis.fetch=async(_url,init)=>{
      signal=init.signal;
      return {ok:true,status:200,json:()=>new Promise(resolve=>{finish=resolve;})};
    };
    const pending=base44.auth.getSocialProviders();
    const failure=assert.rejects(pending,e=>e.code==="NETWORK_TIMEOUT");
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(typeof finish,"function");
    t.mock.timers.tick(8000);
    await failure;
    assert.equal(signal.aborted,true);
    finish({providers:[]});
  });
});

test("incomplete password and social login responses cannot erase the existing session",async()=>{
  await isolated(async()=>{
    base44.auth.setToken("previous-test-session");
    globalThis.fetch=async()=>ok({});
    await assert.rejects(base44.auth.loginViaEmailPassword("user@example.test","test"),e=>e.code==="INVALID_SESSION_RESPONSE");
    assert.equal(base44.auth.getAccessToken(),"previous-test-session");
    await assert.rejects(base44.auth.exchangeSocialTicket("x".repeat(43)),e=>e.code==="INVALID_SESSION_RESPONSE");
    assert.equal(base44.auth.getAccessToken(),"previous-test-session");
    globalThis.fetch=async()=>ok({status:"approved"});
    await assert.rejects(base44.auth.pollDeviceSocialLogin("y".repeat(43)),e=>e.code==="INVALID_SESSION_RESPONSE");
    assert.equal(base44.auth.getAccessToken(),"previous-test-session");
    globalThis.fetch=async()=>ok({access_token:"replacement-test-session"});
    await base44.auth.loginViaEmailPassword("user@example.test","test");
    assert.equal(base44.auth.getAccessToken(),"replacement-test-session");
  });
});
