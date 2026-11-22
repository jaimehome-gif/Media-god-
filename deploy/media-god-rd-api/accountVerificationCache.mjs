import { createHash } from "node:crypto";

// A successful Base44 User/me result is valid for a brief interval. Concurrent
// addon/cache checks from the same browser token share one verification
// request rather than overwhelming Base44 auth with hundreds of calls.
//
// Invalid, absent and expired tokens are NEVER positively cached. Cache keys
// are one-way hashes and never appear in logs or responses. Only the server
// calls this resolver, after parsing the Bearer header.
export function createAccountVerificationCache({
  createClient, appId, now = Date.now,
  ttlMs = 15_000, maxEntries = 500,
} = {}) {
  if (typeof createClient !== "function" || !appId) {
    throw new Error("Verified Base44 client factory and app ID required");
  }
  const positive = new Map();
  const inFlight = new Map();
  const keyFor = token => createHash("sha256").update(token, "utf8").digest("hex");

  const readUser = async token => {
    const client = createClient({ appId, token });
    try {
      const user = await client.auth.me();
      return user && typeof user.id === "string" && user.id
        ? user : null;
    } catch {
      return null;
    }
  };

  return async function verifyBearer(header) {
    const match = /^Bearer ([A-Za-z0-9._~-]{32,8192})$/.exec(String(header || ""));
    if (!match) return null;
    const token = match[1];
    const key = keyFor(token);
    const stamp = now();
    const cached = positive.get(key);
    if (cached && cached.expires > stamp) {
      return { client: createClient({ appId, token }), user: cached.user };
    }
    if (cached) positive.delete(key);

    let pending = inFlight.get(key);
    if (!pending) {
      pending = readUser(token).then(user => {
        if (user) {
          if (positive.size >= maxEntries) {
            for (const [id, record] of positive) {
              if (record.expires <= now()) positive.delete(id);
            }
            if (positive.size >= maxEntries) {
              const oldest = positive.keys().next().value;
              if (oldest) positive.delete(oldest);
            }
          }
          positive.set(key, { user, expires: now() + ttlMs });
        }
        return user;
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    const user = await pending;
    if (!user) return null;
    return { client: createClient({ appId, token }), user };
  };
}
