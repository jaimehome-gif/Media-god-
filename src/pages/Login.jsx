import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import PasswordVisibilityInput from "@/components/mg/PasswordVisibilityInput";
import { SOCIAL_LOGIN_PROVIDERS } from "@/components/mg/SocialLoginSection";
import { safeReturnTo } from "@/lib/authReturnTo";
import { isNativeFireTvPlayerAvailable } from "@/components/mg/nativeFireTvBridge";
import { useAuth } from "@/lib/AuthContext";

const FIRE_TV_RE = /(?:AFT[A-Z0-9]*|Fire TV|AmazonWebAppPlatform|Silk)/i;

const isFireTv = () =>
  typeof navigator !== "undefined" &&
  FIRE_TV_RE.test(String(navigator.userAgent || ""));

const isSelectKey = (event) => {
  const key = String(event?.key || event?.code || "");
  const code = Number(event?.keyCode || event?.which || 0);

  return (
    key === "Enter" ||
    key === "NumpadEnter" ||
    key === "Select" ||
    key === "Accept" ||
    code === 13 ||
    code === 23 ||
    code === 66
  );
};

export default function Login() {
  const { continueAsGuest } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [availableProviders, setAvailableProviders] = useState({});
  const [socialStatus, setSocialStatus] = useState("loading");
  const [deviceLogin, setDeviceLogin] = useState(null);
  const [deviceLoginMessage, setDeviceLoginMessage] = useState("");
  const nativeMediaGodApp = isNativeFireTvPlayerAvailable();
  const socialStartInProgressRef = useRef(false);

  useEffect(() => {
    let active = true;
    base44.auth.getSocialProviders().then(response => {
      if (!active) return;
      setAvailableProviders(Object.fromEntries(
        (response?.providers || []).map(p => [p.id, p.configured === true])
      ));
      setSocialStatus("ready");
    }).catch(() => { if (active) setSocialStatus("unavailable"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const socialError = new URLSearchParams(window.location.search).get("social_error");
    if (!socialError) return;
    const messages = {
      cancelled: "Social sign-in cancelled.",
      invalid_session: "Social sign-in expired. Please try again.",
      not_configured: "That social provider has not been connected yet.",
      unavailable: "Social sign-in couldn't be completed. Please try again."
    };
    setError(messages[socialError] || "Social sign-in couldn't be completed.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const googleButtonRef = useRef(null);
  const fireTv = isFireTv();

  // Post-login destination (e.g. the MCP OAuth consent page sends users here
  // with returnTo so the grant flow can resume). Same-origin paths only.
  const returnTo = safeReturnTo();

  useEffect(() => {
    if (!fireTv) return undefined;

    const focusGoogle = () => {
      const button = googleButtonRef.current;

      if (!(button instanceof HTMLElement) || button.disabled) {
        document.getElementById("email")?.focus();
        return;
      }

      try {
        button.focus({ preventScroll: true });
      } catch {
        button.focus();
      }
    };

    focusGoogle();
    const timer = window.setTimeout(focusGoogle, 220);

    return () => window.clearTimeout(timer);
  }, [fireTv]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // Android WebView / password managers can fill the native DOM input
    // without dispatching React's onChange event. In that case the password
    // looks filled on screen, but the old useState value is blank or stale.
    // Read the real form controls at submit time instead. Never trim/modify
    // the password; the backend normalises only the email address.
    const fields = new FormData(e.currentTarget);
    const submittedEmail = String(fields.get("email") ?? email);
    const submittedPassword = String(fields.get("password") ?? password);
    if (!submittedEmail.trim() || !submittedPassword) {
      setError("Please enter your email and password. If Android filled an old password, clear the field and type your new one.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(submittedEmail, submittedPassword);
      window.location.href = returnTo;
    } catch (err) {
      setError(err?.status === 401
        ? "Email or password not recognised. If the website accepts your new password, clear the phone's saved password and type it manually using the eye icon. You do not need a new account."
        : err.message || "Could not sign in");
    } finally {
      setLoading(false);
    }
  };

  // Google/other providers reject sign-in inside embedded Android WebViews.
  // The installed phone and Fire TV APKs can instead display a device code,
  // then accept an independently authenticated website session. Nothing
  // changes to existing email/password sign-in or saved Real-Debrid tokens.
  useEffect(() => {
    if (!deviceLogin?.device_token) return undefined;
    let alive = true;
    let checking = false;
    const poll = async () => {
      if (!alive || checking) return;
      checking = true;
      try {
        const status = await base44.auth.pollDeviceSocialLogin(deviceLogin.device_token);
        if (alive && status?.status === "approved") {
          window.location.replace(returnTo);
        }
      } catch (err) {
        if (alive && [400, 401, 410].includes(err?.status)) {
          setDeviceLogin(null);
          setDeviceLoginMessage("");
          setError("That device code expired. Select Google sign-in again to get a new code.");
        }
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(poll, 3000);
    void poll();
    return () => { alive = false; window.clearInterval(timer); };
  }, [deviceLogin?.device_token, returnTo]);

  const handleSocial = async (provider) => {
    // Fire TV D-pad Select sometimes sends both keydown and click.
    if (socialStartInProgressRef.current) return;
    socialStartInProgressRef.current = true;
    setError("");
    setDeviceLoginMessage("");
    setSocialLoading(provider);
    try {
      if (!availableProviders[provider]) throw new Error("This sign-in provider is not connected yet.");
      if (nativeMediaGodApp) {
        const device = await base44.auth.startDeviceSocialLogin(provider);
        setDeviceLogin(device);
        setDeviceLoginMessage("Waiting for approval in your normal browser…");
        setSocialLoading(null);
        socialStartInProgressRef.current = false;
        return;
      }
      // Keep the browser on the device-approval screen after a Google
      // round trip, rather than losing the typed pairing code on Home.
      try {
        if (returnTo === "/device-login") {
          window.sessionStorage.setItem("mg:social-return-path", "/device-login");
        } else {
          window.sessionStorage.removeItem("mg:social-return-path");
        }
      } catch { /* Storage may be disabled; normal login still works. */ }
      base44.auth.loginWithProvider(provider, window.location.origin);
    } catch (err) {
      socialStartInProgressRef.current = false;
      setSocialLoading(null);
      setError(err?.message || `Could not start ${provider} sign-in`);
    }
  };

  const handleSkip = () => {
    continueAsGuest();
    window.location.replace("/");
  };

  const handleGoogleRemoteKey = (event) => {
    if (!fireTv || !isSelectKey(event)) return;

    event.preventDefault();
    event.stopPropagation();
    handleSocial("google");
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Sign in with the email and password you verified on Underworld Hub."
      footer={
        <>
          Don’t have a Media God account yet?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-primary font-medium hover:underline"
          >
            Create an Underworld Hub account
          </Link>
        </>
      }
    >
      {deviceLogin && (
        <div role="status" className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
          <p className="mb-2 text-base font-semibold">Complete sign-in in a browser</p>
          <p className="mb-2 text-xs text-muted-foreground">
            On your phone or computer, open <strong>www.underworldhub.co.uk/device-login</strong>,
            sign in with {deviceLogin.provider === "google" ? "Google" : deviceLogin.provider},
            then approve this device with the code below.
          </p>
          <p className="my-3 select-all font-mono text-3xl font-bold tracking-[0.25em]" aria-label="Eight-character device code">
            {deviceLogin.user_code}
          </p>
          <p className="text-xs text-muted-foreground">Code expires after 10 minutes. Keep this screen open.</p>
          {deviceLoginMessage && <p className="mt-2 text-xs">{deviceLoginMessage}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="ghost" onClick={() => { setDeviceLogin(null); setDeviceLoginMessage(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
        {SOCIAL_LOGIN_PROVIDERS.map(({ id, label, Icon }, index) => (
          <Button
            key={id}
            ref={index === 0 ? googleButtonRef : undefined}
            variant="outline"
            className="w-full h-12 text-sm font-medium"
            onClick={() => handleSocial(id)}
            onKeyDown={id === "google" ? handleGoogleRemoteKey : undefined}
            autoFocus={fireTv && index === 0}
            disabled={socialLoading !== null || !availableProviders[id]}
            data-mg-fire-tv-auth-primary={index === 0 && availableProviders[id] ? "true" : undefined}
            title={!availableProviders[id] ? "Social sign-in awaiting provider configuration" : undefined}
          >
            {socialLoading === id ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Icon className="w-5 h-5 mr-2" />
            )}
            Continue with {label}
          </Button>
        ))}
      </div>

      {socialStatus === "ready" && !Object.values(availableProviders).some(Boolean) && (
        <p role="status" className="mb-4 text-xs text-muted-foreground">
          Use email sign-in while social sign-in is unavailable.
        </p>
      )}
      {socialStatus === "unavailable" && (
        <p role="status" className="mb-4 text-xs text-muted-foreground">
          Social sign-in status is temporarily unavailable.
        </p>
      )}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {new URLSearchParams(window.location.search).get("reset") === "success" && (
        <p role="status" className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">Password updated. Please sign in using your new password and the email address that received the reset link.</p>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus={!fireTv}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordVisibilityInput
            id="password"
            name="password"
            label="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>

      <div className="mt-4 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          className="w-full h-11 font-medium"
          onClick={handleSkip}
        >
          Skip for now
        </Button>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          We'll remember this on this device. You can sign in later from Settings.
        </p>
      </div>
      <div className="mt-4 text-center"><Link to="/support" className="text-sm font-medium text-primary hover:underline">Need help? Contact Media God Support</Link></div>
    </AuthLayout>
  );
}
