import test from "node:test";
import assert from "node:assert/strict";
import {boundedSeek,displayTime} from "../public/decoder-lab/media-god-controls.js";
test("web player seeking is bounded to the current personal file",()=>{
  assert.equal(boundedSeek(5,120,-10),0);
  assert.equal(boundedSeek(115,120,10),120);
  assert.equal(boundedSeek(40,120,10),50);
  assert.equal(boundedSeek(40,NaN,10),null);
  assert.equal(boundedSeek(Infinity,120),null);
});
test("web time labels are consistent with native controls",()=>{
  assert.equal(displayTime(0),"0:00");
  assert.equal(displayTime(65),"1:05");
  assert.equal(displayTime(3661),"1:01:01");
  assert.equal(displayTime(Infinity),"0:00");
});
