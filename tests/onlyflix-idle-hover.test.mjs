import test from "node:test";
import assert from "node:assert/strict";
import { installOnlyFlixRemoteHover } from "../src/lib/onlyFlixRemoteHover.js";

test("OnlyFlix remote idle releases hover and the next Select restores hit testing synchronously", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const classes = new Set();
  const frame = { isConnected: true, matches: () => true };
  let active = frame;
  let native = false;
  const win = new EventTarget();
  Object.assign(win, { setTimeout, clearTimeout });
  globalThis.window = win;
  globalThis.document = Object.assign(new EventTarget(), {
    documentElement: { classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) } },
    querySelector: () => active,
  });
  t.after(() => { delete globalThis.window; delete globalThis.document; });
  const select = () => win.dispatchEvent(new Event("mg:onlyflix-pointer-move"));
  installOnlyFlixRemoteHover(() => native);
  select();
  t.mock.timers.tick(3000);
  assert.equal(classes.size, 0);
  native = true;
  select();
  t.mock.timers.tick(2400);
  select();
  t.mock.timers.tick(2499);
  assert.equal(classes.size, 0);
  t.mock.timers.tick(1);
  assert.ok(classes.has("mg-onlyflix-remote-idle"));
  select();
  assert.equal(classes.size, 0);
  active = null;
  frame.isConnected = false;
  t.mock.timers.tick(3000);
  assert.equal(classes.size, 0);
});
