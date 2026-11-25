import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { deviceClient } from "../deploy/media-god-rd-api/deviceClient.mjs";

test("independent HTTP API enforces current identity and account isolation", {timeout:20000}, async () => {
  const dir = await mkdtemp(join(tmpdir(),"mg-independent-auth-"));
  const key = "synthetic-test-key-not-for-production";
  const tokens = {a:"a".repeat(40), b:"b".repeat(40), revoked:"r".repeat(40), outage:"x".repeat(40)};
  const ids = {a:"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",b:"bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"};
  const origin = "https://fixture.invalid";
  let child;
  const listen = server => new Promise((resolve,reject) => {
    server.once("error",reject); server.listen(0,"127.0.0.1",()=>resolve(server.address().port));
  });
  const close = server => new Promise(resolve => server.close(resolve));
  const slot = createServer();
  const port = await listen(slot);
  await close(slot);
  const verifier = createServer((req,res) => {
    const token = req.headers.authorization?.replace(/^Bearer /,"");
    const id = token === tokens.a ? ids.a : token === tokens.b ? ids.b : null;
    res.writeHead(id ? 200 : token === tokens.outage ? 503 : 401,{"Content-Type":"application/json"});
    res.end(JSON.stringify(id ? {id} : {}));
  });
  try {
    const verifierPort = await listen(verifier);
    const verifyUrl = "http://127.0.0.1:"+verifierPort+"/verify";
    const guard = join(dir,"guard.mjs");
    await writeFile(guard, `const original=globalThis.fetch;
globalThis.fetch=(url,options)=>{
 const u=String(url);
 if(u===${JSON.stringify(verifyUrl)}) return original(url,options);
 if(u==="https://api.real-debrid.com/rest/1.0/user"){
   const token=options?.headers?.Authorization;
   if(token==="Bearer synthetic-account-a") return Promise.resolve(Response.json({username:"fixture-a",type:"premium"}));
 }
 throw Error("Unexpected outbound request in isolated fixture");
};`);
    const cap = createHmac("sha256",key).update("mg-account-rd-v1:"+ids.a).digest("hex");
    const account = await deviceClient("Device "+cap,dir);
    await account.client.auth.updateMe({rd_token:"synthetic-account-a"});
    child = spawn(process.execPath,["--import",guard,"deploy/media-god-rd-api/server.mjs"],{
      env:{...process.env,PORT:String(port),IDENTITY_VERIFY_URL:verifyUrl,
        RD_ACCOUNT_DERIVATION_KEY:key,GUEST_DATA_DIR:dir,ALLOWED_ORIGINS:origin},
      stdio:"ignore",
    });
    const base = "http://127.0.0.1:"+port;
    let healthy = false;
    for(let i=0;i<80;i++){
      try { healthy=(await fetch(base+"/health")).ok; if(healthy)break; } catch {}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(healthy,"local server starts");
    const post = (path,token,body={action:"status"},requestOrigin=origin) =>
      fetch(base+"/functions/"+path,{method:"POST",headers:{"Content-Type":"application/json",Origin:requestOrigin,
        ...(token ? {Authorization:"Bearer "+token}: {})},body:JSON.stringify(body)});
    for(const route of ["realDebrid","realDebridAuth","findRdLibrary","multiDebrid","fetchAddonStreams"]){
      assert.equal((await post(route)).status,401,route+" rejects anonymous requests");
      const denied = await post(route,tokens.revoked);
      assert.equal(denied.status,401,route+" rejects revoked sessions");
      assert.equal((await denied.json()).code,"MG_SESSION_REJECTED");
    }
    assert.equal((await post("realDebridAuth",tokens.outage)).status,503);
    assert.equal((await post("realDebridAuth",tokens.a,{action:"status",user_id:ids.b})).status,400);
    assert.equal((await post("realDebridAuth",tokens.a,{action:"status",guest_device_key:"synthetic"})).status,400);
    assert.equal((await post("realDebridAuth",tokens.a,{action:"status",rd_token:"synthetic"})).status,400);
    assert.equal((await post("realDebridAuth",tokens.a,{action:"status"},"https://untrusted.invalid")).status,403);
    const a=await post("realDebridAuth",tokens.a);
    assert.equal(a.status,200); assert.equal((await a.json()).username,"fixture-a");
    assert.equal(a.headers.get("cache-control"),"private,no-store");
    const b=await post("realDebridAuth",tokens.b);
    assert.equal(b.status,200); assert.deepEqual(await b.json(),{connected:false,valid:false});
  } finally {
    if(child && child.exitCode===null){
      const ended=new Promise(resolve=>child.once("exit",resolve));
      child.kill(); await ended;
    }
    await close(verifier);
    await rm(dir,{recursive:true,force:true});
  }
});
