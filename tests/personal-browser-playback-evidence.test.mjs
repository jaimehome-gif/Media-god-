import test from "node:test";
import assert from "node:assert/strict";
import {personalPlaybackEvidence} from "../src/components/mg/personalBrowserPlaybackEvidence.js";
const actual={advancedMs:2000,frames:40,width:640,audioPeak:0.12,audioAvailable:true,paused:false};
test("actual picture and non-silent decoded audio are both required",()=>{
  assert.equal(personalPlaybackEvidence(actual).state,"verified");
  for(const overrides of [{frames:0},{width:0},{advancedMs:0},{audioPeak:0},{audioAvailable:false},{audioPeak:NaN},{paused:true}])
    assert.equal(personalPlaybackEvidence({...actual,...overrides}).state,"pending");
  assert.equal(personalPlaybackEvidence({...actual,errorCode:4}).state,"rejected");
});
test("silence and unsupported measurement remain unknown rather than incompatible",()=>{
  assert.match(personalPlaybackEvidence({...actual,audioPeak:0}).reason,/another scene/);
  assert.match(personalPlaybackEvidence({...actual,audioAvailable:false}).reason,/cannot be measured/);
  assert.equal(personalPlaybackEvidence().state,"pending");
});
