import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("APK social buttons use independent browser device pairing rather than embedded Google WebView",()=>{
  const login=read("src/pages/Login.jsx");
  assert.match(login,/isNativeFireTvPlayerAvailable\(\)/);
  assert.match(login,/base44\.auth\.startDeviceSocialLogin\(provider\)/);
  assert.match(login,/base44\.auth\.pollDeviceSocialLogin\(deviceLogin\.device_token\)/);
  assert.match(login,/window\.location\.replace\(returnTo\)/);
  assert.match(login,/socialStartInProgressRef\.current/);
  assert.match(login,/www\.underworldhub\.co\.uk\/device-login/);
  assert.match(login,/Code expires after 10 minutes/);
  const register=read("src/pages/Register.jsx");
  assert.match(register,/isNativeFireTvPlayerAvailable\(\)/);
  assert.match(register,/window\.location\.assign\("\/login"\)/);
  const client=read("src/api/base44Client.js");
  assert.match(client,/async startDeviceSocialLogin\(provider\)/);
  assert.match(client,/async pollDeviceSocialLogin\(deviceToken\)/);
  assert.match(client,/saveIndependentSessionToken\(result\.access_token\)/);
});

test("browser requires an authenticated account and explicit approval",()=>{
  const page=read("src/pages/DeviceLogin.jsx");
  assert.match(page,/base44\.auth\.me\(\)/);
  assert.match(page,/base44\.auth\.verifyDeviceSocialLogin\(code\)/);
  assert.match(page,/base44\.auth\.approveDeviceSocialLogin\(code\)/);
  assert.match(page,/Yes, approve this device/);
  assert.match(page,/Do not approve a code that someone else sent to you/);
  const app=read("src/App.jsx");
  assert.match(app,/<Route path="\/device-login" element=\{<DeviceLogin \/>\}/);
  assert.match(app,/!isDeviceLoginPath/);
});

test("identity service only approves existing authenticated user IDs and consumes random device tokens once",()=>{
  const server=read("deploy/media-god-identity-api/server.mjs");
  const oauth=read("deploy/media-god-identity-api/socialOAuth.mjs");
  assert.match(server,/path\.startsWith\("\/auth\/device\/"\)/);
  assert.match(server,/createSocialOAuth\(\{pool,issueSession,requireUser,limitRate\}\)/);
  assert.match(oauth,/CREATE TABLE IF NOT EXISTS identity_device_logins/);
  assert.match(oauth,/const owner=await requireUser\(req\)/);
  assert.match(oauth,/WHERE code_hash=\$1 AND approved_user IS NULL AND expires_at>NOW\(\)/);
  assert.match(oauth,/\[sha\(code\),owner\.id\]/);
  assert.match(oauth,/DELETE FROM identity_device_logins WHERE token_hash=\$1 AND expires_at>NOW\(\) AND approved_user IS NOT NULL/);
  assert.match(oauth,/return respond\(res,410,\{error:"Device sign-in expired or already completed"\}/);
  assert.doesNotMatch(oauth,/body\.approved_user|body\.user_id/);
});

test("successful browser social login returns directly to device-code approval when requested",()=>{
  const login=read("src/pages/Login.jsx");
  const cb=read("src/pages/SocialOAuthCallback.jsx");
  assert.match(login,/mg:social-return-path/);
  assert.match(cb,/mg:social-return-path/);
  assert.match(cb,/target = "\/device-login"/);
});


test("approval racing a poll remains pending and the device token is consumed only once", async () => {
  const oauth=read("deploy/media-god-identity-api/socialOAuth.mjs");
  const start=oauth.indexOf('if(path==="/auth/device/status"');
  const end=oauth.indexOf('if(path==="/auth/device/verify"',start);
  assert.ok(start>=0 && end>start,"device status handler exists");
  // Execute the actual status handler with an isolated database double.
  // The OAuth provider dependencies are installed in the identity container,
  // not by the root regression suite.
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const status=new AsyncFunction("req","res","path","body","origin","respond","pool","sha","issueSession",oauth.slice(start,end));
  let row={approved:false},first=true,issued=0;
  const pool={query:async(sql,params)=>{
    if(!sql.startsWith("SELECT * FROM identity_accounts")) assert.equal(params[0],"hashed-token");
    if(sql.startsWith("DELETE FROM identity_device_logins")){
      if(first){first=false;row.approved=true;return {rows:[]};}
      if(!row?.approved)return {rows:[]};
      row=null;
      return {rows:[{approved_user:"owner"}]};
    }
    if(sql.startsWith("SELECT provider FROM identity_device_logins")){
      assert.match(sql,/expires_at>NOW\(\)/);
      // SQL predicates in the actual handler determine whether the just
      // approved record is visible to this poll.
      return {rows:row && (!row.approved || !sql.includes("approved_user IS NULL")) ? [{provider:"google"}] : []};
    }
    if(sql.startsWith("SELECT * FROM identity_accounts")){
      assert.match(sql,/verified_at IS NOT NULL/);
      return {rows:[{id:"owner"}]};
    }
    throw new Error("Unexpected database query");
  }};
  const poll=()=>status({method:"POST"},{},"/auth/device/status",{device_token:"a".repeat(43)},"https://underworldhub.co.uk",
    (_res,code,data)=>({code,data}),pool,
    value=>value==="a".repeat(43)?"hashed-token":value,
    async user=>{assert.equal(user.id,"owner");issued++;return {access_token:"test-session"};});
  assert.deepEqual(await poll(),{code:200,data:{status:"pending"}});
  assert.deepEqual(await poll(),{code:200,data:{status:"approved",access_token:"test-session"}});
  assert.deepEqual(await poll(),{code:410,data:{error:"Device sign-in expired or already completed"}});
  assert.equal(issued,1);
});
