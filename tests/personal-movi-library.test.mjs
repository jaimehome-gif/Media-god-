import test from "node:test";
import assert from "node:assert/strict";
import {personalEndpoint,personalFileEndpoint,personalHeaders,readPersonalRange,personalDeadline} from "../src/components/mg/personalMoviLibrary.js";
const server={id:"s",type:"jellyfin",baseUrl:"https://example.test/media",apiKey:"secret"};
test("personal library uses secure registered server endpoints",async()=>{
  assert.equal((await personalFileEndpoint(server,{id:"abc",serverId:"s"})).href,"https://example.test/media/Videos/abc/stream?Static=true");
  assert.deepEqual(personalHeaders(server),{"X-Emby-Token":"secret"});
  assert.throws(()=>personalEndpoint({...server,baseUrl:"http://example.test"},"/Items"));
  assert.throws(()=>personalEndpoint(server,"//other.test"));
  await assert.rejects(personalFileEndpoint(server,{id:"abc",serverId:"other"}));
});
test("personal media range validates bounds and rejects full file responses",async()=>{
  const original=globalThis.fetch;
  try{
    let options;
    globalThis.fetch=async(url,o)=>{options=o;return new Response(new Uint8Array([1]),{status:206,headers:{"Content-Range":"bytes 0-0/100"}})};
    const r=await readPersonalRange(server,personalEndpoint(server,"/Videos/abc/stream"),0,1);
    assert.equal(r.size,100);assert.equal(r.data.byteLength,1);assert.equal(options.redirect,"error");assert.equal(options.credentials,"omit");
    await assert.rejects(readPersonalRange(server,new URL("https://other.test/"),0,1));
    await assert.rejects(readPersonalRange(server,personalEndpoint(server,"/Items"),0,999999999));
    globalThis.fetch=async()=>new Response("full",{status:200});
    await assert.rejects(readPersonalRange(server,personalEndpoint(server,"/Items"),0,1));
  }finally{globalThis.fetch=original;}
});


test("existing personal Sources results reach Movi on the website without changing native playback",async()=>{
  const {readFileSync}=await import("node:fs");
  const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
  const sources=read("src/components/mg/SourcesView.jsx");
  const movi=read("src/components/mg/PersonalServerMovi.jsx");
  const start=sources.indexOf("const playPersonalResult");
  const end=sources.indexOf("const playCustomDebridSource",start);
  const handler=sources.slice(start,end);
  assert.match(handler,/if \(canOpenPersonalMovi\(\)\) \{\s*setPersonalMoviSelection\(\{ id: String\(result.id\), serverId: result.server.id, title: result.title \}\);\s*return;/);
  assert.match(handler,/player\.play\(/);
  assert.match(handler,/preferNativeVlc: true/);
  assert.match(sources,/<PersonalServerMovi initialItem=\{personalMoviSelection\} playbackOnly/);
  assert.match(movi,/if\(initialItem && canOpenPersonalMovi\(\)\) void play\(initialItem\)/);
  assert.match(movi,/servers\.find\(s=>s\.id===item\.serverId&&s\.active!==false\)/);
  assert.match(movi,/sandbox="allow-scripts"/);
  assert.doesNotMatch(movi,/allow-same-origin/);
});


test("personal request deadlines settle even when a server ignores abort",async()=>{
  let signal;
  await assert.rejects(personalDeadline(active=>{signal=active;return new Promise(()=>{});},undefined,10),/timed out/);
  assert.equal(signal.aborted,true);
  const external=new AbortController();
  const pending=personalDeadline(()=>new Promise(()=>{}),external.signal);
  const rejected=assert.rejects(pending,/cancelled/);
  external.abort();
  await rejected;
});

test("personal range reads cannot expose credentials beyond the registered server path",async()=>{
  const previous=globalThis.fetch;
  try {
    let calls=0;
    globalThis.fetch=async()=>{calls++;return new Response(new Uint8Array([1]),{status:206,headers:{"Content-Range":"bytes 0-0/100"}});};
    await assert.rejects(readPersonalRange(server,new URL("https://example.test/another-service/file"),0,1),/Unexpected server/);
    await assert.rejects(readPersonalRange(server,new URL("https://user:pass@example.test/media/file"),0,1),/Unexpected server/);
    assert.equal(calls,0);
    await readPersonalRange(server,personalEndpoint(server,"/Videos/abc/stream"),0,1);
    assert.equal(calls,1);
  }finally{globalThis.fetch=previous;}
});

test("personal range rejects extra or truncated body bytes",async()=>{
  const previous=globalThis.fetch;
  const url=personalEndpoint(server,"/Videos/abc/stream");
  try {
    for(const bytes of [[1,2,3],[1]]){
      globalThis.fetch=async()=>new Response(new Uint8Array(bytes),{status:206,headers:{"Content-Range":"bytes 0-1/100"}});
      await assert.rejects(readPersonalRange(server,url,0,2),/Invalid media range response/);
    }
  }finally{globalThis.fetch=previous;}
});
