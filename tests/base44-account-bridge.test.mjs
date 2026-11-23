import test from "node:test";
import assert from "node:assert/strict";
import { verifyBase44Session, createBase44Bridge } from "../deploy/media-god-identity-api/base44Bridge.mjs";

test("rejects an invalid legacy token before making a network call", async () => {
  await assert.rejects(verifyBase44Session("bad", () => {
    throw Error("must not run");
  }), e => e.status === 401);
});

test("requires a genuine Base44 profile with an immutable user id", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ id: "legacy-account-123", email: "TEST@example.com" })
  });
  assert.deepEqual(await verifyBase44Session("A".repeat(40), fakeFetch), {
    legacyId: "legacy-account-123", email: "test@example.com"
  });
});

test("rejects mismatched Base44 app ids", async () => {
  await assert.rejects(
    verifyBase44Session("A".repeat(40), async () => ({
      ok: true, json: async () => ({id: "legacy-account-123",email:"test@example.com",app_id:"wrong"})
    })), e => e.status === 401
  );
});

test("an unlinked legacy account cannot obtain a Railway session", async () => {
  let issued = false;
  const pool = { query: async sql => sql.startsWith("SELECT") ? { rows: [] } : { rows: [] } };
  const bridge = createBase44Bridge({
    pool, requireUser: async () => { throw Error("not expected"); },
    issueSession: async () => { issued = true; return {}; },
    limitRate: () => {},
    respond: () => {},
    verify: async () => ({ legacyId: "old-user", email: "owner@example.com" })
  });
  await assert.rejects(bridge.handle({method:"POST"},{},
    "/auth/base44/exchange",{legacy_token:"valid"},""),
    e => e.status === 409 && e.code === "LEGACY_LINK_REQUIRED");
  assert.equal(issued, false);
});

test("linking requires both accounts to have the same verified email", async () => {
  let inserted = false;
  const bridge = createBase44Bridge({
    pool: {query: async () => { inserted=true; return {rows:[]}; }},
    requireUser: async () => ({id:"00000000-0000-4000-8000-000000000001",email:"a@example.com"}),
    issueSession: () => { throw Error("not expected"); },
    limitRate: () => {},
    respond: () => {},
    verify: async () => ({ legacyId: "old-user",email:"b@example.com" })
  });
  await assert.rejects(bridge.handle({method:"POST"},{},
    "/auth/base44/link",{legacy_token:"valid"},""),e => e.status === 403);
  assert.equal(inserted,false);
});
