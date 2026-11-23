import React, { useState } from "react";
import { importLegacyMediaGodAddons } from "@/api/legacyBase44Bridge";

/**
 * Old Base44 addon records are per-user. The independent account must prove
 * ownership of that original account before importing anything. Never auto-
 * import an administrator's records into other members' accounts.
 */
export default function LegacyAddonImporter({ onImported }) {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const result = await importLegacyMediaGodAddons({ email, password });
      setPassword("");
      setNotice(
        result.imported > 0
          ? `Restored ${result.imported} original addon${result.imported === 1 ? "" : "s"}. ${result.skipped || 0} already installed; source searches now use your saved addon list.`
          : `Checked your original account: ${result.available || 0} eligible addons, nothing new to restore. Check the health status of your saved addons below.`
      );
      await onImported?.();
    } catch (e) {
      setError(e?.message || "Could not restore your original addons.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <section data-mg-legacy-addon-import="true" className="rounded-xl border border-white/15 bg-white/5 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold">Missing sources after moving from Base44?</h2>
        <p className="mt-1 text-xs text-white/60">
          Your original addons were saved to your old Media God account. You can securely copy your own addons to this independent account without deleting its existing ones. This does not change Real-Debrid or your Google login.
        </p>
      </div>
      {!expanded ? (
        <button type="button" onClick={() => setExpanded(true)}
          className="min-h-11 rounded-lg border border-mg-green/60 px-3 py-2 text-sm font-semibold text-mg-green">
          Restore my original addons
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="mg-legacy-addon-email" className="block text-xs font-medium">Original Media God email</label>
          <input id="mg-legacy-addon-email" type="email" autoComplete="email" required
            value={email} onChange={event => setEmail(event.target.value)}
            className="w-full rounded-lg border border-white/20 bg-zinc-950 p-3 text-sm"/>
          <label htmlFor="mg-legacy-addon-password" className="block text-xs font-medium">Original Media God password</label>
          <input id="mg-legacy-addon-password" type="password" autoComplete="current-password" required
            value={password} onChange={event => setPassword(event.target.value)}
            className="w-full rounded-lg border border-white/20 bg-zinc-950 p-3 text-sm"/>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={working}
              className="min-h-11 rounded-lg bg-mg-green px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {working ? "Verifying original addons…" : "Verify and restore addons"}
            </button>
            <button type="button" disabled={working} onClick={() => { setPassword(""); setExpanded(false); }}
              className="min-h-11 rounded-lg border border-white/20 px-3 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}
      {notice && <p role="status" className="text-xs text-green-300">{notice}</p>}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      <p className="text-[11px] text-white/50">
        If you only used social login on the original Base44 account, you can add your saved manifest addresses manually below instead. Never share addon credentials in chat.
      </p>
    </section>
  );
}
