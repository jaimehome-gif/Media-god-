import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRollingSourceChecks } from "../src/components/mg/rollingSourceChecks.js";

const home = readFileSync(new URL("../src/components/mg/HomeDashboard.jsx", import.meta.url), "utf8");
const remote = readFileSync(new URL("../src/components/mg/FireTvRemote.jsx", import.meta.url), "utf8");

test("Fire TV first Home paint does not wait for personalised TMDB lookup", () => {
  const paint = home.indexOf("setLoading(false);");
  const recommendations = home.indexOf("void resolveRecommendationSeed({", paint);
  assert.ok(paint > 0, "Home must mark the catalogue ready");
  assert.ok(recommendations > paint, "optional recommendations follow the first interactive paint");
  assert.match(home.slice(recommendations), /if \(!cancelled\) setRecommendationSeed\(seed\)/);
  assert.match(home.slice(recommendations), /\.catch\(\(\) =>/);
});

test("Fire TV player remote remains untouched; held key pacing stays in its existing navigator", () => {
  assert.match(remote, /tapOnlyFlixForRemote/);
  assert.match(remote, /window\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(remote, /const focusables = \(scope\) =>/);
});

class FakeEvents extends EventTarget {
  constructor() {
    super();
    this.visibilityState = "visible";
    this.navigator = {onLine: true};
    this.timeouts = new Map();
    this.intervals = new Map();
    this.nextId = 0;
  }
  setTimeout(fn) { const id = ++this.nextId; this.timeouts.set(id, fn); return id; }
  clearTimeout(id) { this.timeouts.delete(id); }
  setInterval(fn) { const id = ++this.nextId; this.intervals.set(id, fn); return id; }
  clearInterval(id) { this.intervals.delete(id); }
  runTimeouts() {
    for (const [id, fn] of this.timeouts) { this.timeouts.delete(id); fn(); }
  }
  tick() { for (const fn of this.intervals.values()) fn(); }
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test("optional source checks wait for TV warm-up, then yield while D-pad is active", async () => {
  const win = new FakeEvents(), doc = new FakeEvents(), seen = [];
  const stop = createRollingSourceChecks(
    () => [1, 2, 3, 4],
    value => { seen.push(value); },
    { windowObject: win, documentObject: doc, batchSize: 2,
      initialDelayMs: 20000, quietPeriodMs: 5000 },
  );
  win.tick();
  win.dispatchEvent(new Event("focus"));
  await flush();
  assert.deepEqual(seen, [], "no catalogue probes during TV launch");
  win.runTimeouts();
  await flush();
  assert.deepEqual(seen, [1, 2], "deferred probes eventually resume");
  const press = new Event("keydown");
  Object.defineProperty(press, "key", {value: "ArrowRight"});
  win.dispatchEvent(press);
  win.tick();
  await flush();
  assert.deepEqual(seen, [1, 2], "rapid navigation keeps optional work paused");
  stop();
  assert.equal(win.intervals.size, 0);
  assert.equal(win.timeouts.size, 0);
  win.tick();
});

test("stopping TV checks before warm-up prevents delayed requests", async () => {
  const win = new FakeEvents(), doc = new FakeEvents(), seen = [];
  const stop = createRollingSourceChecks(
    () => [1], value => { seen.push(value); },
    { windowObject: win, documentObject: doc, initialDelayMs: 20000, quietPeriodMs: 100 },
  );
  stop();
  win.runTimeouts();
  await flush();
  assert.deepEqual(seen, []);
  assert.equal(win.timeouts.size, 0);
});
