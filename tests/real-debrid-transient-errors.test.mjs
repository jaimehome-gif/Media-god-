import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isTransientRealDebridServiceFailure,
  transientRealDebridMessage,
} from "../src/components/mg/realDebridTransientFailure.js";

test("account, rate-limit and server errors are not invalid torrent evidence", () => {
  for (const status of [401, 403, 408, 429, 500, 502, 503, 504]) {
    assert.equal(isTransientRealDebridServiceFailure({status}), true, String(status));
    assert.match(transientRealDebridMessage({status}), /source|Real-Debrid/i);
  }
  assert.equal(isTransientRealDebridServiceFailure({response:{status:500}}), true);
  assert.equal(isTransientRealDebridServiceFailure({code:"RD_REQUEST_TIMEOUT"}), true);
  assert.equal(isTransientRealDebridServiceFailure({code:"NO_ACCOUNT_SESSION"}), true);
  assert.equal(isTransientRealDebridServiceFailure(new TypeError("Failed to fetch")), true);
});

test("genuinely invalid sources remain eligible for the existing fallback process", () => {
  for (const status of [400, 404, 410, 451]) {
    assert.equal(isTransientRealDebridServiceFailure({status}), false);
  }
  assert.equal(isTransientRealDebridServiceFailure({code:"RD_NO_VIDEO_FILE"}), false);
  assert.equal(isTransientRealDebridServiceFailure({code:"RD_TORRENT_DEAD"}), false);
});

test("video player retains source and manual selection on upstream failure", () => {
  const player = readFileSync(new URL("../src/components/mg/VideoPlayer.jsx", import.meta.url), "utf8");
  const start = player.indexOf("if (isTransientRealDebridServiceFailure(error))");
  assert.ok(start > 0);
  const section = player.slice(start, start + 400);
  assert.match(section, /setRdResolving\(false\)/);
  assert.match(section, /setRdError\(transientRealDebridMessage\(error\)\)/);
  assert.match(section, /return;/);
  assert.ok(section.indexOf("return;") < player.slice(start).indexOf("tryNextSource("));
});
