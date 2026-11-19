import test from "node:test";
import assert from "node:assert/strict";
import { supportsLegacyBoxWebPlayer } from "../src/components/mg/legacyBoxWebPlayer.js";

test("only older non-Amazon hardware in the TV APK gets separate scraper playback", () => {
  const suffix = " MediaGodFireTV/1.0 AmazonWebAppPlatform FireTV";
  const old = "Mozilla/5.0 (Linux; Android 9; X96 Build/PQ3A; wv) Chrome/83.0";
  assert.equal(supportsLegacyBoxWebPlayer(true, old + suffix), true);
  for (const ua of [old.replace("X96", "AFTMM"), old.replace("Android 9", "Android 11"), "unknown"]) {
    assert.equal(supportsLegacyBoxWebPlayer(true, ua + suffix), false);
  }
  assert.equal(supportsLegacyBoxWebPlayer(false, old), false);
});
