import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

// Temporary independent-account constraint; this does not replace the
// existing guest-linking acceptance test. Remove only when guest linking
// has a separately verified, isolated credential flow.
for (const [file, marker] of [
  ["SettingsView.jsx", "const startRdConnect ="],
  ["RealDebridDeviceConnect.jsx", "const startConnect ="],
]) {
  const source = readFileSync(new URL("../src/components/mg/" + file, import.meta.url), "utf8");
  const start = source.indexOf("if (!base44.auth.getAccessToken())", source.indexOf(marker));
  const end = source.indexOf("\n      }", start);
  assert.ok(start >= 0 && end > start);
  const guard = source.slice(start, end + "\n      }".length);
  for (const token of ["", "synthetic-session"]) {
    test(file + " device linking " + (token ? "allows a signed-in session" : "explains unavailable guest linking"), () => {
      const notices = [];
      let continued = false;
      vm.runInNewContext("(function(){" + guard + "\ncontinueFlow();})()", {
        base44: { auth: { getAccessToken: () => token } },
        toast: value => notices.push(value.title + " " + value.description),
        setError: value => notices.push(value),
        continueFlow: () => { continued = true; },
      });
      assert.equal(continued, Boolean(token));
      assert.equal(notices.length, token ? 0 : 1);
      if (!token) assert.match(notices[0], /Guest linking is currently unavailable/i);
    });
  }
}
