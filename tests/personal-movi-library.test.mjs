import test from "node:test";
import assert from "node:assert/strict";
import {personalEndpoint,personalFileEndpoint,personalHeaders,readPersonalRange} from "../src/components/mg/personalMoviLibrary.js";
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
