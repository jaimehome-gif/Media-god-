import { getIndependentSessionToken } from "./base44Client";
import { createClient } from "@base44/sdk";

const APP_ID = "6a95b85c1b5a8657bf3906c8";
const IDENTITY_API = "https://media-god-identity-api-production.up.railway.app";

// Use the original provider for password verification, never Railway.
// Only the resulting Base44 bearer token is exchanged for a Railway session.
export async function authenticateLegacyMediaGod({ email, password, railwayToken = "" }) {
  const client = createClient({
    appId: APP_ID,
    appBaseUrl: "https://app.base44.com",
    serverUrl: "https://app.base44.com",
    requiresAuth: false
  });
  const loginResult = await client.auth.loginViaEmailPassword(email, password);
  const legacyToken = loginResult?.access_token || loginResult?.data?.access_token ||
    (typeof client.auth.getAccessToken === "function" ? await client.auth.getAccessToken() : "");
  if (!legacyToken) throw new Error("Original Media God login did not produce a session.");
  const linking = Boolean(railwayToken);
  const response = await fetch(
    IDENTITY_API + (linking ? "/auth/base44/link" : "/auth/base44/exchange"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(railwayToken ? { Authorization: "Bearer " + railwayToken } : {})
      },
      body: JSON.stringify({ legacy_token: legacyToken }),
      cache: "no-store"
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok && !linking && result.code === "LEGACY_LINK_REQUIRED") {
    const recovery = await fetch(IDENTITY_API + "/auth/base44/recover/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legacy_token: legacyToken }), cache: "no-store"
    });
    const data = await recovery.json().catch(() => ({}));
    if (!recovery.ok) throw new Error(data.error || "Could not send account verification email");
    return { recovery_required: true, legacy_token: legacyToken };
  }
  if (!response.ok) {
    const error = new Error(result.error || "Unable to verify original Media God account");
    error.code = result.code || "LEGACY_LOGIN_FAILED";
    throw error;
  }
  return linking ? { ...result, legacy_token: legacyToken } : result;
}

export async function completeLegacyMediaGodRecovery(legacyToken,code) {
  const response=await fetch(IDENTITY_API + "/auth/base44/recover/complete",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({legacy_token:legacyToken,code}),cache:"no-store"
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result.error || "Could not verify original account.");
  return result;
}

/** Reconnect an original Base44 account and copy only that owner's addons.
 * Railway must already have a verified login. Neither password nor legacy
 * bearer is saved to localStorage or to any shared addon setting.
 */
export async function importLegacyMediaGodAddons({ email, password }) {
  const railwayToken = getIndependentSessionToken();
  if (!railwayToken) throw new Error("Sign in to Media God before restoring addons.");
  const linked = await authenticateLegacyMediaGod({ email, password, railwayToken });
  if (!linked.linked || !linked.legacy_token) {
    throw new Error("The original account could not be linked safely.");
  }
  const response = await fetch(IDENTITY_API + "/auth/base44/import-addons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + railwayToken
    },
    body: JSON.stringify({ legacy_token: linked.legacy_token }),
    cache: "no-store"
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Could not restore your original addon configuration.");
  return result;
}
