import test from "node:test";
import assert from "node:assert/strict";
import { invokeIndependentMetadata } from "../src/api/independentMetadata.js";

test("catalogue transport and cache retain only permitted public fields", async () => {
  const entries = new Map();
  const storage = {
    getItem: key => entries.get(key) || null,
    setItem: (key,value) => entries.set(key,value),
    removeItem: key => entries.delete(key),
    get length() { return entries.size; },
    key: index => [...entries.keys()][index],
  };
  const input = {media_type:"movie",category:"popular",page:2,provider_ids:[8,9],
    authorization:"SYNTHETIC_SECRET",rd_token:"SYNTHETIC_SECRET",
    release_alerts:[{id:123,media_type:"movie",token:"SYNTHETIC_SECRET"}]};
  let calls = 0;
  const expected = {media_type:"movie",category:"popular",page:2,provider_ids:[8,9],
    release_alerts:[{id:123,media_type:"movie"}]};
  const result = await invokeIndependentMetadata(input,{storage,fetchImpl:async (_url,options)=>{
    calls++;
    assert.deepEqual(JSON.parse(options.body),expected);
    assert.equal(options.credentials,"omit");
    assert.deepEqual(options.headers,{"Content-Type":"application/json"});
    return {ok:true,json:async()=>({movies:[]})};
  }});
  assert.equal(calls,1);
  assert.deepEqual(result.data,{movies:[]});
  assert.equal(entries.size,1);
  assert.doesNotMatch([...entries.values()].join(""),/SYNTHETIC_SECRET|rd_token|authorization/);
  const cached = await invokeIndependentMetadata({...input,rd_token:"DIFFERENT_SECRET"},
    {storage,fetchImpl:async()=>{throw Error("offline");}});
  assert.equal(cached.stale,true);
  assert.deepEqual(cached.data,{movies:[]});
});
