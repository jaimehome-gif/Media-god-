import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { railwayDeviceToken } from './railwayDeviceToken.js';
import { invokeIndependentMetadata, invokeIndependentImdbResolver, invokeIndependentAddonSources, invokeIndependentPublicFeature } from './independentMetadata.js';
import { INDEPENDENT_RD_FUNCTIONS, invokeIndependentRealDebrid, readAccountSessionToken } from './independentRealDebrid.js';
import { searchAddonSourcesWithPublicFallback } from './addonSourceRecovery.js';

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
  if (Date.now() < railwayAuthFallbackUntil) {
    // Raw Base44 function requests retain the existing signed-in session
    // and account's stored RD credentials. No credential is sent to the page.
    return rawInvoke(name, payload);
  }

  const sessionToken = options.token || await readAccountSessionToken();
  // A valid account can have a Base44 cookie session but no exportable SDK
  // bearer token (common in embedded Android browser sessions). Never route
  // such a signed-in account as an empty, unrelated Railway guest device.
  if (!sessionToken && await confirmedMediaGodAccount()) {
    railwayAuthFallbackUntil = Date.now() + 90_000;
    return rawInvoke(name, payload);
  }
  try {
    if (sessionToken) {
      return await invokeIndependentRealDebrid(name, payload, { token: sessionToken });
    }
    return await invokeIndependentRealDebrid(name, payload, { deviceToken: railwayDeviceToken() });
  } catch (error) {
    if (Number(error?.status) !== 401 && error?.code !== 'NO_ACCOUNT_SESSION') {
      throw error;
    }
    // A Railway 401 must not promote guests to account access.
    if (!(await confirmedMediaGodAccount())) throw error;
    // Briefly avoid the invalid Railway session while Base44 verifies the
    // current account on its own origin. Probe Railway again afterwards.
    railwayAuthFallbackUntil = Date.now() + 90_000;
    return rawInvoke(name, payload);
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
