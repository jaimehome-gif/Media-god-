import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SOCIAL_LOGIN_PROVIDERS } from "./SocialLoginSection";

export default function IndependentSocialButtons({ onError = () => {} }) {
  const [status, setStatus] = useState("checking");
  const [available, setAvailable] = useState({});
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let active = true;
    base44.auth.getSocialProviders().then(result => {
      if (!active) return;
      setAvailable(Object.fromEntries((result?.providers || []).map(p => [p.id, p.configured === true])));
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("unavailable");
    });
    return () => { active = false; };
  }, []);
  const begin = provider => {
    setBusy(provider);
    onError("");
    try {
      base44.auth.loginWithProvider(provider, window.location.origin);
    } catch (error) {
      setBusy("");
      onError(error?.message || "Social sign-in unavailable. Try again.");
    }
  };
  return (
    <div className="mb-5">
      <div className="grid grid-cols-2 gap-2" aria-label="Social sign-in choices">
        {SOCIAL_LOGIN_PROVIDERS.map(({ id, label, Icon }) => {
          const enabled = status === "ready" && available[id];
          return (
            <button
              key={id}
              type="button"
              disabled={!enabled || Boolean(busy)}
              onClick={() => begin(id)}
              aria-label={enabled ? "Continue with " + label : label + " sign-in not yet configured"}
              className="flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-background px-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {status === "ready" && !Object.values(available).some(Boolean) && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Social sign-in is being connected to our new independent account system.
          You can still browse without signing in.
        </p>
      )}
      {status === "unavailable" && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Social sign-in status could not be checked. Please try again later.
        </p>
      )}
      <div className="relative my-4 text-center text-xs uppercase text-muted-foreground">
        <span className="relative z-10 bg-card px-3">or use your email</span>
        <div className="absolute left-0 right-0 top-1/2 -z-0 border-t border-border" />
      </div>
    </div>
  );
}
