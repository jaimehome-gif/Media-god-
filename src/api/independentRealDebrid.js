import { getAccessToken } from "@base44/sdk";
import { appParams } from "@/lib/app-params";
import { resolveAccountToken } from "./accountSessionToken.js";

/**
 * Real-Debrid requests are resolved on Railway using the authenticated Media
 * God user record. The browser sends only the existing Base44 session token.
 * No Real-Debrid token, refresh credential or private addon URL is transmitted.
 *
 * Guests use a separate device capability and encrypted Railway storage.
 */
export const INDEPENDENT_RD_ENDPOINT =
  "https://media-god-rd-api-production-15b0c56e.up.railway.app";

export const INDEPENDENT_RD_FUNCTIONS = new Set([
  "realDebrid",
  "realDebridAuth",
  "findRdLibrary",
  "multiDebrid",
  "fetchAddonStreams",
]);

const PRIVATE_FIELDS = new Set([
  "rd_token", "rd_refresh_token", "rd_client_secret", "rd_client_id",
  "user_id", "guest_device_key", "authorization", "access_token",
]);

// Rate-limit coordination is per running WebView, never stored with user
// credentials. After Railway reports 429, stop bulk source checks temporarily
// instead of sending hundreds of immediate follow-up requests. Foreground
// playback and the sign-in/refresh routes retain priority.
let discoveryCooldownUntil = 0;
let nextDiscoveryRequestAt = 0;
const DISCOVERY_SPACING_MS = 650;
const MAX_DISCOVERY_QUEUE_MS = 6000;
const isLowPriorityDiscovery = (name, payload) =>
  name === "fetchAddonStreams" ||
  (name === "multiDebrid" && String(payload?.action || "") === "check_cache");
const discoveryBusyError = () => {
  const error = new Error("Source verification is temporarily rate limited. Saved sources remain available; retry shortly.");
  error.status = 429;
  error.code = "RD_DISCOVERY_RATE_LIMITED";
  return error;
};
const reserveDiscoveryRequest = async () => {
  if (Date.now() < discoveryCooldownUntil) throw discoveryBusyError();
  const now = Date.now();
  const due = Math.max(now, nextDiscoveryRequestAt);
  const waitMs = due - now;
  if (waitMs > MAX_DISCOVERY_QUEUE_MS) throw discoveryBusyError();
  nextDiscoveryRequestAt = due + DISCOVERY_SPACING_MS;
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  if (Date.now() < discoveryCooldownUntil) throw discoveryBusyError();
};

export async function readAccountSessionToken({
  getToken = getAccessToken,
  timeoutMs = 1_800,
} = {}) {
  return resolveAccountToken({
    getToken,
    fallbackToken: typeof appParams.token === "string" ? appParams.token : "",
    timeoutMs,
  });
}

export function independentRdPayload(payload = {}) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !PRIVATE_FIELDS.has(key))
  );
}

export async function invokeIndependentRealDebrid(name, payload = {}, {
  fetchImpl = globalThis.fetch,
  token,
  deviceToken,
  timeoutMs = 120_000,
  // A 401 can mean the native WebView's bootstrap session expired while the
  // Base44 SDK refreshed its account token. Retry only if a NEW token exists.
  refreshToken = () => resolveAccountToken({
    getToken: getAccessToken,
    timeoutMs: 1_200,
  }),
} = {}) {
  if (!INDEPENDENT_RD_FUNCTIONS.has(name)) {
    throw new Error("Unsupported independent Real-Debrid function");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("Real-Debrid network unavailable");
  }
  let session = token || await readAccountSessionToken();
  if (!session && !deviceToken) {
    const error = new Error("A Media God account session is required for Railway Real-Debrid");
    error.code = "NO_ACCOUNT_SESSION";
    throw error;
  }
  const controller = new AbortController();
  const hardTimeoutMs = Math.max(1, Number(timeoutMs) || 120_000);
  let timer;
  let timeoutError;
  // Promise.race settles the caller but does not stop an ignored abort.
  // Prevent late responses or token refreshes from starting more work.
  const assertActive = () => {
    if (timeoutError) throw timeoutError;
  };
  // Some Android TV WebViews ignore AbortController, including while reading
  // JSON after a response has already arrived. Bound the *whole* RD operation
  // (including a refreshed-session retry) and never leave playback spinning.
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Real-Debrid request timed out. Try the source again.");
      error.code = "RD_REQUEST_TIMEOUT";
      timeoutError = error;
      reject(error);
      controller.abort();
    }, hardTimeoutMs);
  });
  try {
    const operation = (async () => {
    const body = JSON.stringify(independentRdPayload(payload));
    if (isLowPriorityDiscovery(name, payload)) await reserveDiscoveryRequest();
    assertActive();
    const request = () => fetchImpl(
      `${INDEPENDENT_RD_ENDPOINT}/functions/${name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": deviceToken ? `Device ${deviceToken}` : `Bearer ${session}`,
        },
        body,
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      },
    );
    let response = await request();
    assertActive();
    // Railway verifies every request with Base44 auth.me. A rejected session
    // can be retried safely ONLY when the SDK actually obtained a different
    // Media God session. A 403 (origin/permission denial) is never retried.
    if (!deviceToken && response.status === 401 && typeof refreshToken === "function") {
      let fresh = "";
      try {
        fresh = String(await refreshToken() || "").trim();
      } catch {
        // Retain the original signed-in failure and reconnect guidance.
      }
      assertActive();
      if (fresh && fresh !== session) {
        session = fresh;
        response = await request();
        assertActive();
      }
    }
    if (response.status === 429) {
      // This cooldown covers *discovery* requests only. A user-initiated Play
      // or account refresh must still reach the server for an exact verdict.
      const retryAfter = Number(response?.headers?.get?.("retry-after") || 0);
      const cooldownMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(90_000, Math.max(20_000, retryAfter * 1000))
        : 30_000;
      discoveryCooldownUntil = Math.max(discoveryCooldownUntil, Date.now() + cooldownMs);
    }
    let data = {};
    try { data = await response.json(); } catch {}
    assertActive();
    if (!response.ok) {
      const message = typeof data?.error === "string"
        ? data.error
        : `Real-Debrid returned ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.response = { data, status: response.status };
      throw error;
    }
    return { data, status: response.status };
    })();
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
