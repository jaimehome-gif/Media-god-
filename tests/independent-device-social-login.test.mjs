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
