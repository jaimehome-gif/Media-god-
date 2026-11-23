import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("a verified password reset clears both lockout counters and old sessions", () => {
  const server = read("deploy/media-god-identity-api/server.mjs");
  const reset = server.slice(server.indexOf('if (path==="/auth/reset"'), server.indexOf('const user=await requireUser(req);', server.indexOf('if (path==="/auth/reset"')));
  assert.match(reset, /reset_hash=\$2 AND reset_expires>NOW\(\)/);
  assert.match(reset, /login_failures=0,locked_until=NULL/);
  assert.match(reset, /RETURNING id,email/);
  assert.match(reset, /if \(!rows.length\) err\(400,"Reset link expired or used"\)/);
  assert.match(reset, /identity_sessions SET revoked_at=NOW\(\)/);
  assert.match(reset, /clearLoginRateForEmail\(rows\[0\]\.email\)/);
  assert.ok(reset.indexOf("if (!rows.length)") < reset.indexOf("clearLoginRateForEmail"),
    "An invalid or expired token must not clear login locks");
});

test("failed guesses still trigger lockout but cooldown expires cleanly", () => {
  const server = read("deploy/media-god-identity-api/server.mjs");
  const login = server.slice(server.indexOf('if (path==="/auth/login"'), server.indexOf('if (path==="/auth/reset-request"'));
  assert.match(login, /"ACCOUNT_LOCKED"/);
  assert.match(login, /locked_until=CASE WHEN locked_until<=NOW\(\) THEN NULL/);
  assert.match(login, /login_failures=CASE WHEN locked_until<=NOW\(\) THEN 1 ELSE login_failures\+1 END/);
  assert.match(login, /WHEN login_failures>=4 THEN NOW\(\)\+INTERVAL '15 minutes'/);
  assert.match(server, /state\.kind=kind;[\s\S]*?state\.emailHash=sha\(email\)/);
  assert.match(server, /state\.kind==="login" && state\.emailHash===emailHash/);
});

test("password visibility is optional, accessible and never logs entered passwords", () => {
  const input = read("src/components/mg/PasswordVisibilityInput.jsx");
  assert.match(input, /useState\(false\)/);
  assert.match(input, /type=\{visible \? "text" : "password"\}/);
  assert.match(input, /type="button"/);
  assert.match(input, /aria-label=\{\x60\$\{visible \? "Hide" : "Show"\}/);
  assert.match(input, /aria-pressed=\{visible\}/);
  assert.match(input, /autoCapitalize="none"/);
  assert.doesNotMatch(input, /console\.|localStorage|sessionStorage|fetch\(/);
  for (const [path, count] of [
    ["src/pages/Login.jsx", 1],
    ["src/pages/Register.jsx", 2],
    ["src/pages/ResetPassword.jsx", 2],
  ]) {
    const page=read(path);
    assert.equal((page.match(/<PasswordVisibilityInput\b/g) || []).length, count, path);
  }
});

test("registration and password-reset screens enforce backend password policy", () => {
  for (const path of ["src/pages/Register.jsx", "src/pages/ResetPassword.jsx"]) {
    const page = read(path);
    assert.match(page, /\.length < 12 \|\| .*\.length > 128/);
  }
});

test("other-device unlock requires a current session and can touch only its owner", () => {
  const backend=read("deploy/media-god-identity-api/server.mjs");
  const start=backend.indexOf('  const user=await requireUser(req);');
  const route=backend.indexOf('if (path==="/auth/unlock-login"&&req.method==="POST")',start);
  const end=backend.indexOf('if (path==="/auth/me"&&req.method==="GET")',route);
  assert.ok(start>=0 && route>start && end>route,"unlock must be after session authentication");
  const body=backend.slice(route,end);
  assert.match(body,/limitRate\(req,"unlock",user\.email\)/);
  assert.match(body,/WHERE id=\$1/);
  assert.match(body,/\[user\.id\]/);
  assert.match(body,/clearLoginRateForEmail\(user\.email\)/);
  assert.doesNotMatch(body,/body\.email|body\.userId|password_hash/);
});

test("signed-in Settings exposes self-unlock and never offers it to guests", () => {
  const client=read("src/api/base44Client.js");
  assert.match(client,/async unlockLogin\(\)\s*\{[\s\S]*?call\(IDENTITY_API,"\/auth\/unlock-login",\{method:"POST"/);
  const settings=read("src/components/mg/SettingsView.jsx");
  assert.match(settings,/if \(!me \|\| unlockingSignIn\) return;/);
  assert.match(settings,/await base44\.auth\.unlockLogin\(\)/);
  assert.match(settings,/\{me \? \([\s\S]*?Unlock sign-in on my other devices/);
  assert.match(settings,/It unlocks[\s\S]*?does not change your password/);
});
