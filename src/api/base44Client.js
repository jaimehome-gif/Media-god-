import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { railwayDeviceToken } from './railwayDeviceToken.js';
import { invokeIndependentMetadata, invokeIndependentImdbResolver, invokeIndependentAddonSources, invokeIndependentPublicFeature } from './independentMetadata.js';
import { INDEPENDENT_RD_FUNCTIONS, invokeIndependentRealDebrid, readAccountSessionToken } from './independentRealDebrid.js';
import { searchAddonSourcesWithPublicFallback } from './addonSourceRecovery.js';
import { readGuestDebridDeviceKey } from '@/components/mg/guestDebridDevice';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const rawInvoke = base44.functions.invoke.bind(base44.functions);

// Earlier Media God versions saved some Real-Debrid connections against a
// device-specific Base44 guest key. Railway intentionally uses a different,
// independently encrypted device capability. Probe the *existing* Base44
// record without generating or copying credentials, then preserve it.
let legacyGuestModeUntil = 0;
let legacyGuestProbeUntil = 0;
let legacyGuestConnected = false;
let legacyGuestProbePromise = null;

const legacyGuestPayload = (payload = {}) => {
  const key = readGuestDebridDeviceKey();
  return key ? { ...payload, guest_device_key: key } : payload;
};

const verifiedLegacyGuestDebrid = async () => {
  const key = readGuestDebridDeviceKey();
  if (!key) return false;
  if (Date.now() < legacyGuestProbeUntil) return legacyGuestConnected;
  if (!legacyGuestProbePromise) {
    legacyGuestProbePromise = rawInvoke('realDebridAuth', {
      action: 'status',
      guest_device_key: key,
    })
      .then(result => result?.data?.connected === true && result?.data?.valid === true)
      .catch(() => false)
      .then(connected => {
        legacyGuestConnected = connected;
        legacyGuestProbeUntil = Date.now() + (connected ? 120_000 : 20_000);
        if (connected) legacyGuestModeUntil = Date.now() + 120_000;
        return connected;
      })
      .finally(() => { legacyGuestProbePromise = null; });
  }
  return legacyGuestProbePromise;
};


// A signed-in Media God account can work through Base44 while Railway's
// independent auth check temporarily rejects its browser session. Keep
// Railway as the primary route; only a 401 may activate the account-scoped
// native backend fallback. Never treat 403, 429 or 5xx as authentication.
let railwayAuthFallbackUntil = 0;
let accountVerificationPromise = null;

const confirmedMediaGodAccount = async () => {
  if (!accountVerificationPromise) {
    accountVerificationPromise = base44.auth.me()
      .then(user => Boolean(user?.id))
      .catch(() => false)
      .finally(() => { accountVerificationPromise = null; });
  }
  return accountVerificationPromise;
};

const invokeAuthenticatedDebrid = async (name, payload = {}, options = {}) => {
  if (Date.now() < legacyGuestModeUntil && readGuestDebridDeviceKey()) {
    // Base44 authenticates the existing guest key and looks up only its
    // device-owned Real-Debrid connection. Railway never receives this key.
    return rawInvoke(name, legacyGuestPayload(payload));
  }
  if (Date.now() < railwayAuthFallbackUntil) {
    // A Base44-verified signed-in user can use their existing stored RD
    // account while the Railway bearer-token handoff recovers.
    return rawInvoke(name, payload);
  }

  const sessionToken = options.token || await readAccountSessionToken();
  if (!sessionToken) {
    if (await confirmedMediaGodAccount()) {
      railwayAuthFallbackUntil = Date.now() + 90_000;
      return rawInvoke(name, payload);
    }
    // On migration, an existing device guest account may still be linked in
    // Base44 despite the new Railway device store starting empty.
    if (await verifiedLegacyGuestDebrid()) {
      return rawInvoke(name, legacyGuestPayload(payload));
    }
  }

  try {
    const result = sessionToken
      ? await invokeIndependentRealDebrid(name, payload, { token: sessionToken })
      : await invokeIndependentRealDebrid(name, payload, { deviceToken: railwayDeviceToken() });

    // Railway can correctly authenticate a newly created device while its
    // credentials are empty. A previously linked Base44 guest stays linked.
    if (name === 'realDebridAuth' && (payload?.action || 'status') === 'status' &&
        result?.data?.connected !== true && await verifiedLegacyGuestDebrid()) {
      return rawInvoke(name, legacyGuestPayload(payload));
    }
    return result;
  } catch (error) {
    if (Number(error?.status) !== 401 && error?.code !== 'NO_ACCOUNT_SESSION') {
      throw error;
    }
    if (await confirmedMediaGodAccount()) {
      railwayAuthFallbackUntil = Date.now() + 90_000;
      return rawInvoke(name, payload);
    }
    // A Railway 401 never grants account access. The legacy backend itself
    // verifies that this device already owns a valid RD guest connection.
    if (await verifiedLegacyGuestDebrid()) {
      return rawInvoke(name, legacyGuestPayload(payload));
    }
    throw error;
  }
};


base44.functions.invoke = async (name, payload = {}, ...rest) => {
  // Public catalogue, search and metadata never use Base44 integration
  // credits. This endpoint contains no personal data or credentials.
  if (name === 'getTmdbMovies') {
    return invokeIndependentMetadata(payload);
  }
  if (name === 'resolveImdb' || name === 'resolveTvImdb') {
    return invokeIndependentImdbResolver(name, payload);
  }
  if (name === 'fetchAddonStreams' && !payload?.action) {
    return searchAddonSourcesWithPublicFallback(payload, {
      readToken: readAccountSessionToken,
      searchPersonal: (request, options) =>
        invokeAuthenticatedDebrid('fetchAddonStreams', request, options),
      searchPublic: invokeIndependentAddonSources,
    });
  }
  if (name === 'getEntertainmentNews' || name === 'getSkipSegments' ||
      name === 'getFireTvApkLink') {
    return invokeIndependentPublicFeature(name, payload);
  }
  // Both account and isolated guest-device requests run on Railway.
  if (INDEPENDENT_RD_FUNCTIONS.has(String(name || ''))) {
    return invokeAuthenticatedDebrid(name, payload);
  }
  return rawInvoke(name, payload, ...rest);
};
