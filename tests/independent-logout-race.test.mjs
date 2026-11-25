import test from "node:test";
import assert from "node:assert/strict";
import {base44,IDENTITY_API} from "../src/api/base44Client.js";

test("delayed logout revokes only the previous session and preserves a new login",async()=>{
  const priorWindow=globalThis.window,priorFetch=globalThis.fetch;
  const values=new Map(), redirects=[], requests=[];
  globalThis.window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},location:{assign:path=>redirects.push(path)}};
  let completeLogout;
  try {
    globalThis.fetch=async(url,init)=>{
      requests.push({url,init});
      if(url===IDENTITY_API+"/auth/logout") return new Promise(resolve=>{completeLogout=()=>resolve({ok:true,json:async()=>({ok:true})});});
      assert.equal(url,IDENTITY_API+"/auth/login");
      assert.equal(init.headers.Authorization,undefined);
      return {ok:true,json:async()=>({access_token:"new-session"})};
    };
    base44.auth.setToken("old-session");
    const logout=base44.auth.logout("/login");
    assert.equal(base44.auth.getAccessToken(),"");
    await base44.auth.loginViaEmailPassword("person@example.test","test-only");
    completeLogout();
    await logout;
    assert.equal(requests[0].init.headers.Authorization,"Bearer old-session");
    assert.equal(base44.auth.getAccessToken(),"new-session");
    assert.deepEqual(redirects,[]);
  } finally {globalThis.fetch=priorFetch;if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
});

test("offline sign-out still clears credentials and returns to login",async()=>{
  const priorWindow=globalThis.window,priorFetch=globalThis.fetch;
  const values=new Map(),redirects=[];
  globalThis.window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},location:{assign:path=>redirects.push(path)}};
  try {
    base44.auth.setToken("old-session");
    globalThis.fetch=async()=>{throw Error("offline");};
    await base44.auth.logout("/login");
    assert.equal(base44.auth.getAccessToken(),"");
    assert.deepEqual(redirects,["/login"]);
  } finally {globalThis.fetch=priorFetch;if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
});
