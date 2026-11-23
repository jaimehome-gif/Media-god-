import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

for (const platform of ["android-mobile", "firetv-android"]) {
  const app = platform === "android-mobile" ? "mobile" : "firetv";
  const source = read(platform + "/app/src/main/java/com/mediagod/" + app + "/MainActivity.kt");
  const guard = source.slice(source.indexOf("private fun nativeBridgeAllowed()"), source.indexOf("private fun dispatchJavascript("));
  test(platform + " accepts only official apex and www hosts after OAuth", () => {
    assert.ok(guard.includes('"underworldhub.co.uk", "www.underworldhub.co.uk"'));
    assert.ok(guard.includes('currentHost == "underworldhub.co.uk"'));
    assert.ok(guard.includes('currentHost == "www.underworldhub.co.uk"'));
    assert.ok(guard.includes('else -> currentHost == expectedHost'));
    assert.ok(guard.includes('trustedHost &&'));
    assert.ok(guard.includes('current.port == expected.port'));
    assert.ok(guard.includes('current.scheme.equals(expected.scheme, ignoreCase = true)'));
    assert.ok(guard.includes('expected.scheme.equals("https", ignoreCase = true)'));
    assert.doesNotMatch(guard, /endsWith\\(/, "bridge trust must not accept attacker-controlled subdomains");
  });
}

test("mobile APK and Fire TV APK have matching increased release metadata", () => {
  for (const [app, publicManifest, version, code] of [
    ["android-mobile","android-mobile-update.json","1.0.97",98],
    ["firetv-android","firetv-update.json","1.4.127",132],
  ]) {
    const gradle=read(app+"/app/build.gradle.kts");
    const manifest=JSON.parse(read("public/"+publicManifest));
    assert.match(gradle, new RegExp('versionCode = '+code+'\\b'));
    assert.ok(gradle.includes('versionName = "'+version+'"'));
    assert.equal(manifest.versionCode,code);
    assert.equal(manifest.versionName,version);
  }
});
