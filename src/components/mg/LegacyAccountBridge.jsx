import React, { useState } from "react";
import { authenticateLegacyMediaGod } from "@/api/legacyBase44Bridge";
import { base44 } from "@/api/base44Client";

// The user explicitly verifies both accounts to link them. We never match
// identities solely by email, or silently migrate private records.
export default function LegacyAccountBridge({ mode = "login" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const linking = mode === "link";

  async function submit(event) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const railwayToken = linking ? base44.auth.getAccessToken() : "";
      if (linking && !railwayToken) {
        throw new Error("Sign into your Underworld Hub account before linking.");
      }
      const result = await authenticateLegacyMediaGod({ email, password, railwayToken });
      setPassword("");
      if (linking) {
        setMessage("Original Media God account securely linked. You can now use the original account to sign in.");
      } else if (result.access_token) {
        base44.auth.setToken(result.access_token);
        window.location.assign("/");
      } else {
        throw new Error("The sign-in service did not provide a usable session.");
      }
    } catch (e) {
      setError(e?.message || "Original account verification failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/15 p-4 mt-4" aria-label="Original Media God account">
      <h3 className="text-sm font-semibold">
        {linking ? "Link your original Media God account" : "Already used the original Media God?"}
      </h3>
      <p className="mt-2 mb-3 text-xs text-muted-foreground">
        {linking
          ? "Enter your old Media God credentials to prove you own both accounts. This does not delete or overwrite either account."
          : "Original accounts must be securely linked to Underworld Hub before they can sign in here. If you haven't linked yours, use your Underworld Hub login first and visit Settings."}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label className="text-xs" htmlFor={"legacy-email-" + mode}>Original account email</label>
        <input id={"legacy-email-" + mode} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-md border border-white/20 bg-transparent p-2 text-sm" />
        <label className="text-xs" htmlFor={"legacy-password-" + mode}>Original account password</label>
        <input id={"legacy-password-" + mode} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className="rounded-md border border-white/20 bg-transparent p-2 text-sm" />
        <button type="submit" disabled={working} className="rounded-md border border-white/25 p-2 text-sm font-semibold disabled:opacity-50">
          {working ? "Verifying…" : linking ? "Link original account" : "Sign in with linked original account"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      {message && <p role="status" className="mt-2 text-xs text-green-400">{message}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        Need your previous social sign-in? Open your original Media God app at{" "}
        <a className="underline" href="https://mysterious-media-vault-pro.base44.app/" target="_blank" rel="noopener noreferrer">the original website</a>.
      </p>
    </section>
  );
}
