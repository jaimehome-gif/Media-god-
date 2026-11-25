import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("../src/lib/accountPreferenceSync.js",import.meta.url),"utf8")
  .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];\s*/gm,"")
  .replace(/export const /g,"const ");

function harness(){
  let token="account-A",serial=0;
  const timers=new Map(), writes=[], listeners=new Map();
  const window={
    localStorage:{getItem:()=>null},
    setTimeout:fn=>{timers.set(++serial,fn);return serial;},
    clearTimeout:id=>timers.delete(id),
    setInterval:()=>++serial,clearInterval:()=>{},
    addEventListener:(event,fn)=>listeners.set(event,fn),
    removeEventListener:event=>listeners.delete(event),
  };
  const context={
    window,
    base44:{auth:{
      getAccessToken:()=>token,
      updateMe:async patch=>{writes.push({token,patch:JSON.parse(JSON.stringify(patch))});},
      me:async()=>{throw Error("Preference patch must not fetch and overwrite unrelated fields");}
    }},
    PLAYBACK_PREFERENCES_KEY:"playback", MEDIA_TRACK_PREFERENCES_KEY:"tracks", SOURCE_SELECTOR_SORT_KEY:"sort",
    readPlaybackPreferences:()=>({}),readTrackPreferences:()=>({}),
    writePlaybackPreferences:()=>{},writeTrackPreferences:()=>{},writeSourceSortMode:()=>{},
  };
  const api=vm.runInNewContext(source+"\n({queueAccountPreferencePatch,installAccountPreferenceSync,hydrateAccountPreferences})",context);
  return {api,writes,changeToken:v=>token=v,flush:async()=>{for(const [id,fn] of [...timers]){timers.delete(id);await fn();}}};
}

test("pending preference edits never cross into another account",async()=>{
  const h=harness();
  h.api.queueAccountPreferencePatch({quality:"old-account-value"});
  h.changeToken("account-B");
  await h.flush();
  assert.deepEqual(h.writes,[]);
  h.api.queueAccountPreferencePatch({autoplay:true});
  await h.flush();
  assert.deepEqual(h.writes,[{token:"account-B",patch:{preferences:{autoplay:true}}}]);
});

test("new account edits replace queued old account edits and contain only changed fields",async()=>{
  const h=harness();
  h.api.queueAccountPreferencePatch({quality:"old"});
  h.changeToken("account-B");
  h.api.queueAccountPreferencePatch({autoplay:true});
  h.api.queueAccountPreferencePatch({subs:false});
  await h.flush();
  assert.deepEqual(h.writes,[{token:"account-B",patch:{preferences:{autoplay:true,subs:false}}}]);
});

test("guest and unmounted preference listeners cannot persist stale account changes",async()=>{
  const h=harness();
  const stop=h.api.installAccountPreferenceSync();
  h.api.queueAccountPreferencePatch({quality:"old"});
  stop();
  h.changeToken("");
  h.api.queueAccountPreferencePatch({quality:"guest"});
  await h.flush();
  assert.deepEqual(h.writes,[]);
  h.changeToken("account-B");
  h.api.queueAccountPreferencePatch({autoplay:false});
  await h.flush();
  assert.deepEqual(h.writes,[{token:"account-B",patch:{preferences:{autoplay:false}}}]);
});
