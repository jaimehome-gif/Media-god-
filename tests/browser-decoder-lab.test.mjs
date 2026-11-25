import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("experimental decoder is a protected app route and sandboxed", () => {
  const app = read("src/App.jsx");
  const page = read("src/pages/BrowserDecoderTest.jsx");
  assert.match(app, /<Route path="\/browser-decoder-test"/);
  assert.match(page, /sandbox="allow-scripts"/);
  assert.doesNotMatch(page, /allow-same-origin/);
  assert.match(page, /src="\/decoder-lab\/index.html"/);
});

test("decoder lab uses fixed generated media and software mode, never the catalogue", () => {
  const lab = read("public/decoder-lab/lab.js");
  assert.match(lab, /player\.setAttribute\("sw", "true"\)/);
  assert.match(lab, /credentials: "omit"/);
  assert.match(lab, /new File\(\[await response\.blob\(\)\], name\)/);
  assert.doesNotMatch(lab, /URLSearchParams|postMessage|localStorage|<video|RealDebrid|magnet:/i);
  for (const name of ["aac.mp4", "ac3.mkv", "eac3.mkv", "dts.mkv"]) assert.ok(lab.includes(name));
  const docker = read("deploy/media-god-web/Dockerfile");
  assert.match(docker, /npm pack --ignore-scripts movi-player@0\.4\.1/);
  assert.match(docker, /testsrc2=size=320x180/);
  assert.match(docker, /sine=frequency=440/);
});
