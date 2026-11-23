import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Verify the device code while signed in on the independent WEBSITE.
 * Approval requires the owner's existing bearer session, is one-time and
 * cannot transfer a session to an attacker using only an eight-character code.
 */
export default function DeviceLogin() {
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    base44.auth.me().then(me => { if (mounted) setAccount(me); })
      .catch(() => { if (mounted) setAccount(null); })
      .finally(() => { if (mounted) setLoadingAccount(false); });
    return () => { mounted = false; };
  }, []);

  const normaliseCode = text => String(text || "").toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 8);
  const checkCode = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      setVerified(await base44.auth.verifyDeviceSocialLogin(code));
    } catch (err) {
      setVerified(null);
      setError(err?.message || "Could not check that code.");
    } finally {
      setBusy(false);
    }
  };
  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      await base44.auth.approveDeviceSocialLogin(code);
      setApproved(true);
    } catch (err) {
      setError(err?.message || "Could not authorise the device.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout icon={ShieldCheck} title="Connect Media God on another device"
      subtitle="Secure sign-in with your existing independent Media God account">
      {loadingAccount ? (
        <p role="status" className="flex gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Checking your sign-in…</p>
      ) : !account ? (
        <div className="space-y-4 text-sm">
          <p>First sign in to Media God in this normal browser using Google or your existing email and password. Then return here to enter the code shown in your app.</p>
          <Link className="text-primary font-semibold underline"
            to="/login?returnTo=%2Fdevice-login">Sign in to Media God</Link>
        </div>
      ) : approved ? (
        <div role="status" className="space-y-3 text-sm">
          <p className="font-semibold">Device approved successfully.</p>
          <p>Return to the Media God app. It will complete the sign-in automatically using the one-time device session.</p>
          <Link to="/" className="text-primary underline">Return to Media God</Link>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p>Signed in as <strong className="break-all">{account.email}</strong>. Only continue if this is the account you want on the other device.</p>
          <form onSubmit={checkCode} className="space-y-3">
            <label htmlFor="mg-device-code" className="font-medium">Eight-character code shown in the app</label>
            <Input id="mg-device-code" value={code} onChange={e => {
                setCode(normaliseCode(e.target.value));
                setVerified(null);
              }} placeholder="ABCDEFGH" autoCapitalize="characters"
              autoComplete="off" spellCheck={false} maxLength={8}
              className="h-12 text-center font-mono text-xl tracking-widest" required/>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 8}>
              {busy ? "Checking…" : "Check device code"}
            </Button>
          </form>
          {verified?.ready && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <p>Approve <strong>{verified.provider}</strong> sign-in for the Media God app displaying this exact code?</p>
              <p className="text-xs text-muted-foreground">Do not approve a code that someone else sent to you. This will grant the device access to your existing Media God account.</p>
              <Button onClick={approve} disabled={busy} className="w-full">
                {busy ? "Approving…" : "Yes, approve this device"}
              </Button>
            </div>
          )}
          {error && <p role="alert" className="text-destructive">{error}</p>}
        </div>
      )}
    </AuthLayout>
  );
}
