import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createBase44Recovery } from "../deploy/media-god-identity-api/base44Recovery.mjs";

const setup = (overrides={}) => {
  let issued=0, emailed=0, queries=[];
  const pool={query:async (sql,args=[])=>{queries.push({sql,args});return {rows:[],rowCount:0};}};
  const recovery=createBase44Recovery({
    pool, issueSession:async ()=>{issued++;return {access_token:"test-session"};},
    emailSend:async ()=>{emailed++;},
    hashPass:async ()=>"random-hash",
    sha:value=>createHash("sha256").update(value).digest("hex"),
    token:()=>"random-disabled-password",
    limitRate:()=>{},
    respond:(res,status,data)=>({status,data}),
    verify:async()=>({legacyId:"old-verified-user",email:"original@example.com"}),
    ...overrides
  });
  return {recovery,pool,stats:()=>({issued,emailed,queries})};
};

test("original-account recovery requires a valid six-digit mailbox code",async()=>{
  const {recovery,stats}=setup();
  await assert.rejects(
    recovery.handle({method:"POST"},{},"/auth/base44/recover/complete",
      {legacy_token:"verified",code:"wrong"},""),
    error=>error.status===400
  );
  assert.equal(stats().issued,0);
});

test("recovery challenge emails the verified Base44 address without issuing a session",async()=>{
  const {recovery,stats}=setup();
  const result=await recovery.handle({method:"POST"},{},"/auth/base44/recover/start",
    {legacy_token:"verified"},"");
  assert.equal(result.status,200);
  assert.equal(stats().emailed,1);
  assert.equal(stats().issued,0);
  assert.equal(stats().queries[0].args[1],"original@example.com");
});

test("expired email challenge cannot grant account access",async()=>{
  const {recovery,stats}=setup();
  await assert.rejects(
    recovery.handle({method:"POST"},{},"/auth/base44/recover/complete",
      {legacy_token:"verified",code:"123456"},""),
    error=>error.status===401
  );
  assert.equal(stats().issued,0);
});
