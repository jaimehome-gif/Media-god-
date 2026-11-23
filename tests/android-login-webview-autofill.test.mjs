import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("Android login reads the actual WebView form fields, not stale controlled React state", () => {
  const login = read("src/pages/Login.jsx");
  assert.match(login, /const fields = new FormData\(e\.currentTarget\)/);
  assert.match(login, /const submittedEmail = String\(fields\.get\("email"\) \?\? email\)/);
  assert.match(login, /const submittedPassword = String\(fields\.get\("password"\) \?\? password\)/);
  assert.match(login, /loginViaEmailPassword\(submittedEmail, submittedPassword\)/);
  assert.doesNotMatch(login, /loginViaEmailPassword\(email, password\)/);
  assert.match(login, /id="email"\s*name="email"/);
  assert.match(login, /id="password"\s*name="password"/);
});

test("The Android autofill fix does not mutate user passwords or expose them in error text", () => {
  const login = read("src/pages/Login.jsx");
  assert.doesNotMatch(login, /submittedPassword\.trim\(\)/);
  assert.doesNotMatch(login, /console\.(log|error|warn)\([^)]*submittedPassword/);
  assert.match(login, /If the website accepts your new password/);
  const input = read("src/components/mg/PasswordVisibilityInput.jsx");
  assert.match(input, /type=\{visible \? "text" : "password"\}/);
  assert.match(input, /autoCorrect="off"/);
});
