import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createSocialOAuth } from "./socialOAuth.mjs";

const hash = x => createHash("sha256").update(String(x)).digest("hex");
const response = () => ({
  code: 0, body: null, headers: {},
  setHeader(name,value){ this.headers[name]=value; },
  writeHead(code){ this.code=code; },
  end(){}
});
const respond = (res,code,data) => { res.code=code; res.body=data; };
function testPool() {
  let entry=null, accountId="existing-verified-owner";
  const queries=[];
  return {
    queries,
    async query(sql,args=[]) {
      queries.push({sql,args});
      if(sql.startsWith("INSERT INTO identity_device_logins")) {
        if(entry) return {rows:[]};
        entry={tokenHash:args[0],codeHash:args[1],provider:args[2],approvedUser:null};
        return {rows:[{token_hash:args[0]}]};
      }
      if(sql.startsWith("SELECT provider FROM identity_device_logins WHERE code_hash")) {
        return {rows:entry && entry.codeHash===args[0] && !entry.approvedUser
          ? [{provider:entry.provider}] : []};
      }
      if(sql.startsWith("UPDATE identity_device_logins SET approved_user")) {
        if(!entry || entry.codeHash!==args[0] || entry.approvedUser) return {rows:[]};
        entry.approvedUser=args[1];
        return {rows:[{provider:entry.provider}]};
      }
      if(sql.startsWith("SELECT provider FROM identity_device_logins WHERE token_hash")) {
        return {rows:entry && entry.tokenHash===args[0] && !entry.approvedUser
          ? [{provider:entry.provider}] : []};
      }
      if(sql.startsWith("DELETE FROM identity_device_logins WHERE token_hash")) {
        if(!entry || entry.tokenHash!==args[0] || !entry.approvedUser) return {rows:[]};
        const user=entry.approvedUser;
        entry=null;
        return {rows:[{approved_user:user}]};
      }
      if(sql.startsWith("SELECT * FROM identity_accounts WHERE id=")) {
        return {rows:args[0]===accountId
          ? [{id:accountId,email:"owner@gmail.com",verified_at:new Date()}] : []};
      }
      return {rows:[]};
    }
  };
}
const request=(url,method="POST")=>({method,url,headers:{origin:""}});
const envGoogle=()=>{
  process.env.GOOGLE_CLIENT_ID="test-client";
  process.env.GOOGLE_CLIENT_SECRET="test-secret";
};
const clearGoogle=()=>{ delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; };

test("secure browser device code only signs into the approved, verified account", async()=>{
  envGoogle();
  try {
    const pool=testPool();
    const oauth=createSocialOAuth({
      pool,
      issueSession:async user=>({access_token:"test-session-"+user.id}),
      requireUser:async()=>({id:"existing-verified-owner",email:"owner@gmail.com"}),
      limitRate:()=>{},
    });
    await oauth.initialize();
    const call=async(path,body={})=>{
      const res=response();
      await oauth.handle(request(path),res,path,body,"",respond);
      return res;
    };
    const created=await call("/auth/device/start",{provider:"google"});
    assert.equal(created.code,200);
    assert.match(created.body.user_code,/^[A-HJ-NP-Z2-9]{8}$/);
    assert.match(created.body.device_token,/^[A-Za-z0-9_-]{40,100}$/);
    assert.equal(created.body.verification_url,"https://www.underworldhub.co.uk/device-login");
    assert.equal((await call("/auth/device/status",{device_token:created.body.device_token})).body.status,"pending");
    assert.equal((await call("/auth/device/verify",{user_code:created.body.user_code})).body.provider,"google");
    assert.equal((await call("/auth/device/approve",{user_code:"INVALID00"})).code,400);
    assert.equal((await call("/auth/device/approve",{user_code:created.body.user_code})).body.ok,true);
    const completed=await call("/auth/device/status",{device_token:created.body.device_token});
    assert.equal(completed.code,200);
    assert.equal(completed.body.status,"approved");
    assert.equal(completed.body.access_token,"test-session-existing-verified-owner");
    assert.equal((await call("/auth/device/status",{device_token:created.body.device_token})).code,410);
    assert.ok(pool.queries.some(q=>q.sql.includes("approved_user=$2") && q.args[1]==="existing-verified-owner"));
  } finally {
    clearGoogle();
  }
});

test("unconfigured providers cannot create device sign-in sessions",async()=>{
  delete process.env.FACEBOOK_CLIENT_ID;
  delete process.env.FACEBOOK_CLIENT_SECRET;
  const oauth=createSocialOAuth({
    pool:testPool(),issueSession:async()=>({}),
    requireUser:async()=>{throw Error("Not authenticated");},
    limitRate:()=>{},
  });
  const res=response();
  await oauth.handle(request("/auth/device/start"),res,"/auth/device/start",{provider:"facebook"},"",respond);
  assert.equal(res.code,503);
});

test("anonymous visitors cannot approve another device's login",async()=>{
  envGoogle();
  try{
    const pool=testPool();
    const oauth=createSocialOAuth({
      pool,issueSession:async()=>({}),
      requireUser:async()=>{ throw Error("Not authenticated"); },
      limitRate:()=>{},
    });
    const started=response();
    await oauth.handle(request("/auth/device/start"),started,"/auth/device/start",{provider:"google"},"",respond);
    await assert.rejects(async()=>{
      const res=response();
      await oauth.handle(request("/auth/device/approve"),res,"/auth/device/approve",
        {user_code:started.body.user_code},"",respond);
    },/Not authenticated/);
    assert.ok(!pool.queries.some(q=>q.sql.startsWith("UPDATE identity_device_logins SET approved_user")));
  }finally{clearGoogle();}
});
