import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { SOCIAL_LOGIN_PROVIDERS } from "@/components/mg/SocialLoginSection";
import { safeReturnTo } from "@/lib/authReturnTo";
import { useAuth } from "@/lib/AuthContext";

export default function Register() {
  const { continueAsGuest } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [registrationReady, setRegistrationReady] = useState(false);
  const [registrationChecked, setRegistrationChecked] = useState(false);
  const [availableProviders, setAvailableProviders] = useState({});
  useEffect(() => {
    let active = true;
    base44.auth.getRegistrationConfig()
      .then(config => { if (active) setRegistrationReady(config?.registration_ready === true); })
      .finally(() => { if (active) setRegistrationChecked(true); });
    base44.auth.getSocialProviders()
      .then(config => { if (active) setAvailableProviders(
        Object.fromEntries((config?.providers || []).map(p => [p.id,p.configured === true]))
      ); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!registrationReady) { setError("Email registration is not open until verification delivery is connected."); return; }
    if (password.length < 12) { setError("Use at least 12 characters for your new password."); return; }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowVerification(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try { await base44.auth.resendOtp(email); }
    catch (err) { setError(err?.message || "Failed to resend verification email"); }
  };

  const handleSkip = () => {
    continueAsGuest();
    window.location.replace("/");
  };

  const handleSocial = (provider) => {
    setError("");
    setSocialLoading(provider);

    try {
      if (!availableProviders[provider]) throw new Error("This social provider has not been connected yet.");
      base44.auth.loginWithProvider(provider, window.location.origin);
    } catch (err) {
      setSocialLoading(null);
      setError(err?.message || `Could not start ${provider} sign-up`);
    }
  };

  if (showVerification) {
    return (
      <AuthLayout icon={Mail} title="Verify your email"
        subtitle={`We sent a verification link to ${email}`}>
        {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
        <p className="mb-5 text-sm">Open the verification link in your email to activate your independent Media God account.</p>
        <Button variant="outline" className="w-full h-12" onClick={handleResend}>Resend verification email</Button>
        <Link to="/login" className="mt-4 block text-center text-sm text-primary underline">Go to sign in</Link>
        <Button type="button" variant="ghost" className="mt-3 w-full h-11 font-medium" onClick={handleSkip}>Skip for now</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
        {SOCIAL_LOGIN_PROVIDERS.map(({ id, label, Icon }) => (
          <Button
            key={id}
            variant="outline"
            className="w-full h-12 text-sm font-medium"
            onClick={() => handleSocial(id)}
            disabled={socialLoading !== null || !availableProviders[id]}
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

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {registrationChecked && !registrationReady && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Verification emails are being connected. Email registration opens once delivery is ready.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading || !registrationReady}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
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
    </AuthLayout>
  );
}
