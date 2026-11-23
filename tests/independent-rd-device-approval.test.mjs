import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deviceClient } from "../deploy/media-god-rd-api/deviceClient.mjs";
import realDebridAuth from "../deploy/media-god-rd-api/realDebridAuth.mjs";

test("device approval reports the saved account immediately and after reopening storage", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rd-device-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const owner = "Device " + "ab".repeat(32);
  t.mock.method(globalThis, "fetch", async input => {
    const path = new URL(input).pathname;
    const responses = {
      "/oauth/v2/device/credentials": { client_id: "test-client", client_secret: "test-secret" },
      "/oauth/v2/token": { access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 },
      "/rest/1.0/user": { username: "device-test" },
    };
    assert.ok(responses[path], path);
    return Response.json(responses[path]);
  });
  for (const body of [{ action: "poll_device", device_code: "test-code" }, { action: "status" }]) {
    const { client, user } = await deviceClient(owner, directory);
    const req = new Request("http://localhost/functions/realDebridAuth", {
      method: "POST", body: JSON.stringify(body),
    });
    Object.assign(req, {
      __mediaGodVerifiedClient: client, __mediaGodVerifiedUser: user, __mediaGodVerifiedUserId: user.id,
    });
    const response = await realDebridAuth(req);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).connected, true);
  }
});
