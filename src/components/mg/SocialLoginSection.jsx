import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { isNativeFireTvPlayerAvailable } from "@/components/mg/nativeFireTvBridge";
import GoogleIcon from "@/components/GoogleIcon";

export const FacebookIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
      fill="#1877F2"
    />
  </svg>
);

export const MicrosoftIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3h8v8H3z" fill="#F25022" />
    <path d="M13 3h8v8h-8z" fill="#7FBA00" />
    <path d="M3 13h8v8H3z" fill="#00A4EF" />
    <path d="M13 13h8v8h-8z" fill="#FFB900" />
  </svg>
);

export const AppleIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.13zM14.6 4.59c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-3 1.54-.66.76-1.24 1.98-1.08 3.15 1.14.09 2.31-.58 3.02-1.44z" />
  </svg>
);

export const SOCIAL_LOGIN_PROVIDERS = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon },
  { id: "microsoft", label: "Microsoft", Icon: MicrosoftIcon },
  { id: "apple", label: "Apple", Icon: AppleIcon },
];

/*
 * Linking is different from signing in. The existing verified Media God
 * account authorises a two-minute one-time link intent; a provider OAuth
 * callback can attach only its verified subject to that account.
 * Never merge accounts based on Facebook/Apple/Microsoft email assertions.
 */
export default function SocialLoginSection() {
  const [account, setAccount] = useState(null);
  const [providers, setProviders] = useState([]);
  const [ready, setReady] = useState(false);
  const [linking, setLinking] = useState("");
  const [error, setError] = useState("");
  const nativeApp = isNativeFireTvPlayerAvailable();

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([base44.auth.me(),base44.auth.getSocialProviders()])
      .then(([identity,configuration]) => {
        if (!mounted) return;
        if (identity.status === "fulfilled") setAccount(identity.value);
        if (configuration.status === "fulfilled") {
          setProviders((configuration.value?.providers || []).filter(p => p.configured === true));
        }
      }).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  if (!ready || !account) return null;

  const linkProvider = async provider => {
    if (linking) return;
    setError("");
    setLinking(provider);
    try {
      await base44.auth.connectSocialProvider(provider);
      // The browser is redirected to the provider; its callback completes
      // the same account link. Never mark it connected before that proof.
    } catch (cause) {
      setLinking("");
      setError(cause?.message || "Could not start social account connection.");
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-mg-card p-4" aria-label="Connect social sign-in">
      <h2 className="text-base font-semibold text-white">Connect sign-in methods</h2>
      <p className="mt-1 text-xs leading-5 text-white/60">
        Link other sign-in providers to the <strong className="text-white">{account.email}</strong> account
        so your watch history and Real-Debrid settings stay with the same Media God user.
      </p>
      {nativeApp ? (
        <p className="mt-3 text-xs text-amber-200">
          Connect extra providers from Media God Settings at www.underworldhub.co.uk
          in Chrome or another normal browser, then use browser approval to sign in on this device.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {SOCIAL_LOGIN_PROVIDERS.filter(p => providers.some(x => x.id === p.id)).map(({id,label,Icon}) => (
            <button key={id} type="button"
              onClick={() => void linkProvider(id)} disabled={Boolean(linking)}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-mg-green/30 bg-mg-green/10 px-3 py-2 text-sm font-semibold text-mg-green hover:bg-mg-green/20 disabled:opacity-50">
              <Icon className="h-4 w-4"/>
              {linking === id ? "Connecting…" : "Connect " + label}
            </button>
          ))}
          {!providers.length && (
            <p className="text-xs text-white/50">Social providers appear here when their independent Railway credentials are configured.</p>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </section>
  );
}
