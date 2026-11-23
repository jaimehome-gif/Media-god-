import test from "node:test";
import assert from "node:assert/strict";
import { selectOwnedLegacyAddons, createBase44Bridge } from "../deploy/media-god-identity-api/base44Bridge.mjs";

const originalId = "legacy-owner";
const owner = "owner@example.com";
const userId = "00000000-0000-4000-8000-000000000001";
const sample = (name, url, created_by_id = originalId) => ({
  name, url, created_by_id, installed:true, active:true
});

test("addon migration accepts only owned HTTPS public-host manifests", () => {
  const rows = selectOwnedLegacyAddons({entities:[
    sample("AIOStreams", "https://aiostreams.elfhosted.com/owner/manifest.json"),
    sample("Another member's addon", "https://addon.other.example/manifest.json", "other-owner"),
    sample("Dangerous local address", "https://127.0.0.1/manifest.json"),
    sample("Dangerous auth URL", "https://admin:secret@example.com/manifest.json"),
    sample("Not a URL", "javascript:alert(1)"),
  ]}, originalId);
  assert.deepEqual(rows.map(item=>item.name), ["AIOStreams"]);
  assert.equal(rows[0].url, "https://aiostreams.elfhosted.com/owner/manifest.json");
});

const setup = ({linked=true, email=owner, remoteRows=[]}={}) => {
  const inserted = [];
  let base44Calls=0;
  const pool = { query: async (sql, params) => {
    if (sql.includes("FROM identity_base44_links")) return {rows:linked?[{legacy_user_id:originalId}]:[]};
    if (sql.includes("SELECT data->>'url'")) return {rows:[{url:"https://torrentio.strem.fun/manifest.json"}]};
    if (sql.includes("INSERT INTO identity_records")) {
      inserted.push({params});
      return {rows:[],rowCount:1};
    }
    throw new Error("Unexpected query");
  }};
  const bridge = createBase44Bridge({
    pool, requireUser:async()=>({id:userId,email:owner}),
    verify:async()=>({legacyId:originalId,email}),
    limitRate:()=>{},
    issueSession:()=>{throw new Error("Unexpected session minting");},
    respond:(res,status,data)=>({status,data}),
    fetchImpl:async (url,options)=>{
      base44Calls++;
      assert.match(url, /\/entities\/Addon\?limit=100$/);
      assert.equal(options.headers["X-App-Id"],"6a95b85c1b5a8657bf3906c8");
      assert.equal(options.headers.Authorization,"Bearer original-verified-token");
      return {ok:true,json:async()=>({entities:remoteRows})};
    }
  });
  return {bridge,inserted,base44Calls:()=>base44Calls};
};

test("only imports the verified user's addons; skips duplicates and preserves previous records", async()=>{
  const ctx=setup({remoteRows:[
    sample("Torrentio","https://torrentio.strem.fun/manifest.json"),
    sample("MediaFusion","https://mediafusion.elfhosted.com/owner/manifest.json"),
    sample("Orion","https://orion.example/manifest.json","different-owner")
  ]});
  const result=await ctx.bridge.handle({method:"POST"},{},"/auth/base44/import-addons",
    {legacy_token:"original-verified-token"},"");
  assert.equal(result.status,200);
  assert.equal(result.data.imported,1);
  assert.equal(result.data.available,2);
  assert.equal(ctx.inserted.length,1);
  const body=JSON.parse(ctx.inserted[0].params[2]);
  assert.equal(body.name,"MediaFusion");
  assert.equal(body.created_by_id,userId);
  assert.equal(body.created_by,owner);
  assert.ok(!JSON.stringify(result).includes("manifest.json"),"response must never expose configured manifest URLs");
});

test("unlinked original account cannot read or import addons", async()=>{
  const ctx=setup({linked:false,remoteRows:[sample("AIO","https://a.example/manifest.json")]});
  await assert.rejects(
    ctx.bridge.handle({method:"POST"},{},"/auth/base44/import-addons",
      {legacy_token:"original-verified-token"},""),
    error=>error.status===403);
  assert.equal(ctx.base44Calls(),0);
  assert.equal(ctx.inserted.length,0);
});

test("matching Railway email is mandatory even for a linked user id",async()=>{
  const ctx=setup({email:"another@example.com"});
  await assert.rejects(
    ctx.bridge.handle({method:"POST"},{},"/auth/base44/import-addons",
      {legacy_token:"original-verified-token"},""),
    error=>error.status===403);
  assert.equal(ctx.base44Calls(),0);
});
