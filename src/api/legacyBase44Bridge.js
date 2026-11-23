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
  await client.auth.loginViaEmailPassword(email, password);
  const legacyToken = client.auth.getAccessToken();
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
  if (!response.ok) {
    const error = new Error(result.error || "Unable to verify original Media God account");
    error.code = result.code || "LEGACY_LOGIN_FAILED";
    throw error;
  }
  return result;
}
