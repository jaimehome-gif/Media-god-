import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("password reset and login use the same independent identity service", () => {
  const client = read("src/api/base44Client.js");
  assert.match(client, /IDENTITY_API[\s\S]*?media-god-identity-api-production\.up\.railway\.app/);
  assert.match(client, /"\/auth\/reset"[\s\S]*?password:newPassword/);
  assert.match(client, /"\/auth\/login"[\s\S]*?email,password/);
});

test("password reset returns to the verified independent website rather than the old host", () => {
  const reset = read("src/pages/ResetPassword.jsx");
  assert.match(reset, /www\.underworldhub\.co\.uk\/login\?reset=success/);
  assert.match(reset, /base44\.auth\.resetPassword\(\{ resetToken, newPassword \}\)/);
  const login = read("src/pages/Login.jsx");
  assert.match(login, /Password updated\. Please sign in using your new password/);
  assert.match(login, /You can use your existing email address with your new Media God account/);
  assert.doesNotMatch(login, /Old Base44 accounts must be registered again/);
});
