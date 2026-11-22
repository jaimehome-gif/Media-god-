import test from "node:test";
import assert from "node:assert/strict";
import { createAccountVerificationCache } from "../deploy/media-god-rd-api/accountVerificationCache.mjs";

const bearer = token => "Bearer " + token;
const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);

test("200 concurrent signed-in source requests validate the same token only once", async () => {
  let checks = 0;
  const createClient = ({token}) => ({auth:{me:async()=>{
    checks++;
    await new Promise(resolve=>setTimeout(resolve,5));
    return {id:token===tokenA?"user-a":"user-b"};
  }}});
  const verify = createAccountVerificationCache({createClient,appId:"media-god-test"});
  const batch = await Promise.all(Array.from({length:200},()=>verify(bearer(tokenA))));
  assert.equal(checks,1);
  assert.ok(batch.every(item=>item?.user?.id==="user-a"));
  assert.equal(batch[0].client.auth.me instanceof Function,true);
});

test("only the same token shares verification, never a different user's account", async () => {
  let checks = 0;
  const verify = createAccountVerificationCache({
    createClient:({token})=>({auth:{me:async()=>{checks++;return {id:token===tokenA?"user-a":"user-b"};}}}),
    appId:"media-god-test",
  });
  const [a,b] = await Promise.all([verify(bearer(tokenA)),verify(bearer(tokenB))]);
  assert.equal(a.user.id,"user-a");
  assert.equal(b.user.id,"user-b");
  assert.equal(checks,2);
});

test("expired and rejected logins do not receive a cached or borrowed session", async () => {
  let checks=0;
  const verify = createAccountVerificationCache({
    createClient:()=>({auth:{me:async()=>{checks++;throw new Error("Invalid account");}}}),
    appId:"media-god-test",
  });
  assert.equal(await verify(bearer(tokenA)),null);
  assert.equal(await verify(bearer(tokenA)),null);
  assert.equal(checks,2);
  for (const bad of ["", "Device "+tokenA,"Bearer short","Bearer "+tokenA+" invalid"]) {
    assert.equal(await verify(bad),null);
  }
  assert.equal(checks,2);
});

test("verified sessions must be revalidated after 15-second TTL expires", async () => {
  let stamp=100_000,checks=0;
  const verify = createAccountVerificationCache({
    createClient:()=>({auth:{me:async()=>{checks++;return {id:"ok"};}}}),
    appId:"media-god-test",now:()=>stamp,ttlMs:15_000,
  });
  assert.equal((await verify(bearer(tokenA))).user.id,"ok");
  stamp+=14_999;
  assert.equal((await verify(bearer(tokenA))).user.id,"ok");
  assert.equal(checks,1);
  stamp+=1;
  assert.equal((await verify(bearer(tokenA))).user.id,"ok");
  assert.equal(checks,2);
});

test("cache never allows request-auth header to masquerade as another device", async()=>{
  const verify=createAccountVerificationCache({
    createClient:()=>({auth:{me:async()=>({id:"ok"})}}),
    appId:"media-god-test",
  });
  assert.equal(await verify("Device "+tokenA),null);
  assert.equal(await verify("Basic "+tokenA),null);
  assert.equal(await verify(null),null);
});
