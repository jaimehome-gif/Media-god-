import { randomUUID } from "node:crypto";\n// Secure, opt-in bridge: a Railway session may only be minted after Base44
// verifies the bearer token against Media God's exact historical app ID.
// Never trust an email or user id supplied by the browser.
const APP_ID = "6a95b85c1b5a8657bf3906c8";
const VERIFY_URL = "https://app.base44.com/api/apps/" + APP_ID + "/entities/User/me";
const MAX_TOKEN_LENGTH = 4096;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function verifyBase44Session(rawToken, fetchImpl = fetch) {
  if (typeof rawToken !== "string" || rawToken.length < 20 ||
      rawToken.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9._~-]+$/.test(rawToken)) {
    const e = Error("Invalid legacy sign-in token"); e.status = 401; throw e;
  }
  let response;
  try {
    response = await fetchImpl(VERIFY_URL, {
      method: "GET",
      headers: { Authorization: "Bearer " + rawToken, "X-App-Id": APP_ID, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    const e = Error("Original Media God authentication is temporarily unavailable");
    e.status = 503; throw e;
  }
  if (!response.ok) {
    const e = Error(response.status === 401 || response.status === 403
      ? "Original Media God sign-in has expired"
      : "Original Media God account verification is unavailable");
    e.status = response.status === 401 || response.status === 403 ? 401 : 503;
    throw e;
  }
  const raw = await response.json().catch(() => null);
  const profile = raw?.data?.id ? raw.data : raw;
  if (!profile || typeof profile.id !== "string" ||
      !/^[a-zA-Z0-9_-]{3,128}$/.test(profile.id) ||
      typeof profile.email !== "string" ||
      !emailPattern.test(profile.email.trim()) ||
      profile.email.length > 254 ||
      (profile.app_id && profile.app_id !== APP_ID)) {
    const e = Error("Original Media God identity could not be verified");
    e.status = 401; throw e;
  }
  return { legacyId: profile.id, email: profile.email.trim().toLowerCase() };
}

// Never import another Base44 user's addons or copy internal addresses into
// Media God's independent database. This is a user-initiated migration only.
const privateHost = (host) => {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  if (!h || h === "localhost" || h.endsWith(".local") ||
      h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const bytes = h.split(".").map(Number);
    if (bytes.some(x => x < 0 || x > 255)) return true;
    const [a,b] = bytes;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);
  }
  return h.includes(":");
};

export const selectOwnedLegacyAddons = (payload, legacyId) => {
  const rows = Array.isArray(payload) ? payload :
    Array.isArray(payload?.data) ? payload.data :
    Array.isArray(payload?.items) ? payload.items :
    Array.isArray(payload?.records) ? payload.records : [];
  return rows.slice(0, 100).filter(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    // The old Addon schema is owner-scoped. Require that owner explicitly.
    if (String(row.created_by_id || "") !== String(legacyId)) return false;
    const name = String(row.name || "").trim();
    if (!name || name.length > 100 || typeof row.url !== "string" ||
        row.url.length > 2048) return false;
    try {
      const url = new URL(row.url);
      return url.protocol === "https:" && !url.username &&
        !url.password && !privateHost(url.hostname);
    } catch { return false; }
  }).map(row => ({
    name: String(row.name).trim(),
    url: String(row.url).trim(),
    description: String(row.description || "").slice(0, 600),
    type: String(row.type || "Torrent").slice(0, 50),
    active: row.active !== false,
    installed: row.installed !== false
  }));
};

export function createBase44Bridge({ pool, requireUser, issueSession, limitRate, respond, verify = verifyBase44Session, fetchImpl = fetch }) {
  return {
    async initialize() {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS identity_base44_links (legacy_user_id TEXT PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES identity_accounts(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
      );
    },
    async handle(req, res, path, body, origin) {
      // A user must first prove BOTH existing sessions before binding accounts.
      // Email matching alone must NEVER steal a Railway account.
      if (path === "/auth/base44/link" && req.method === "POST") {
        const railway = await requireUser(req);
        limitRate(req, "legacy-link", railway.email);
        const legacy = await verify(body.legacy_token);
        if (legacy.email !== railway.email) {
          const e = Error("Both accounts must use the same verified email address"); e.status = 403; throw e;
        }
        const existing = await pool.query(
          "SELECT legacy_user_id,user_id FROM identity_base44_links WHERE legacy_user_id=$1 OR user_id=$2",
          [legacy.legacyId, railway.id]
        );
        if (existing.rows.length) {
          if (existing.rows.length !== 1 || existing.rows[0].legacy_user_id !== legacy.legacyId ||
              existing.rows[0].user_id !== railway.id) {
            const e = Error("This original account is linked to a different user"); e.status = 409; throw e;
          }
        } else {
          await pool.query("INSERT INTO identity_base44_links(legacy_user_id,user_id) VALUES($1,$2)",
            [legacy.legacyId, railway.id]);
        }
        return respond(res, 200, { ok: true, linked: true }, origin);
      }
      if (path === "/auth/base44/import-addons" && req.method === "POST") {
        const railway = await requireUser(req);
        limitRate(req, "legacy-addon-import", railway.id);
        const legacy = await verify(body.legacy_token);
        if (legacy.email !== railway.email) {
          const e = Error("The verified original account email does not match your Media God account");
          e.status = 403; throw e;
        }
        const { rows: links } = await pool.query(
          "SELECT legacy_user_id FROM identity_base44_links WHERE legacy_user_id=$1 AND user_id=$2",
          [legacy.legacyId, railway.id]
        );
        if (links.length !== 1) {
          const e = Error("Link your original account before restoring addons");
          e.status = 403; throw e;
        }
        let response;
        try {
          response = await fetchImpl(
            "https://app.base44.com/api/apps/" + APP_ID + "/entities/Addon?limit=100",
            { method: "GET",
              headers: { Authorization: "Bearer " + body.legacy_token,
                "X-App-Id": APP_ID, Accept: "application/json" },
              redirect: "error", signal: AbortSignal.timeout(12000) }
          );
        } catch {
          const e = Error("Original addon records are temporarily unavailable"); e.status = 503; throw e;
        }
        if (!response.ok) {
          const e = Error("Original addon records could not be accessed"); e.status =
            response.status === 401 || response.status === 403 ? 403 : 503; throw e;
        }
        const legacyAddons = selectOwnedLegacyAddons(
          await response.json().catch(() => []), legacy.legacyId
        );
        const { rows: existing } = await pool.query(
          "SELECT data->>'url' AS url FROM identity_records WHERE user_id=$1 AND entity='Addon'",
          [railway.id]
        );
        const urls = new Set(existing.map(x => String(x.url || "").toLowerCase().replace(/\/+$/, "")));
        let imported = 0;
        for (const addon of legacyAddons) {
          const key = addon.url.toLowerCase().replace(/\/+$/, "");
          if (urls.has(key)) continue;
          urls.add(key);
          // Store only in the verified user's private independent Addon records.
          await pool.query(
            "INSERT INTO identity_records(id,user_id,entity,data) VALUES($1,$2,'Addon',$3::jsonb)",
            [randomUUID(), railway.id, JSON.stringify({
              ...addon, created_by_id: railway.id, created_by: railway.email
            })]
          );
          imported++;
        }
        return respond(res, 200, {
          ok: true, imported, available: legacyAddons.length,
          skipped: legacyAddons.length - imported
        }, origin);
      }
      if (path === "/auth/base44/exchange" && req.method === "POST") {
        limitRate(req, "legacy-exchange");
        const legacy = await verify(body.legacy_token);
        const { rows } = await pool.query(
          "SELECT a.* FROM identity_base44_links l JOIN identity_accounts a ON a.id=l.user_id WHERE l.legacy_user_id=$1 AND a.verified_at IS NOT NULL",
          [legacy.legacyId]
        );
        if (!rows.length || rows[0].email !== legacy.email) {
          const e = Error("Your original Media God account has not yet been securely linked to this website. Sign in using your existing Underworld Hub account first, then link the accounts in Settings.");
          e.status = 409; e.code = "LEGACY_LINK_REQUIRED"; throw e;
        }
        return respond(res, 200, await issueSession(rows[0]), origin);
      }
      return false;
    }
  };
}
