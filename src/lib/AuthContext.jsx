import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import {
  hydrateAccountPreferences,
  installAccountPreferenceSync,
} from '@/lib/accountPreferenceSync';
import { mediaGodAuthReturnUrl } from '@/lib/mediaGodAuth';

const AuthContext = createContext(null);

const GUEST_MODE_KEY = 'mg_guest_mode';

const readGuestMode = () => {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(GUEST_MODE_KEY) === '1';
  } catch {
    return false;
  }
};

const writeGuestMode = (enabled) => {
  if (typeof window === 'undefined') return;

  try {
    if (enabled) {
      window.localStorage.setItem(GUEST_MODE_KEY, '1');
    } else {
      window.localStorage.removeItem(GUEST_MODE_KEY);
    }
  } catch {
    // Storage may be unavailable in private/restricted browser modes.
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(() => readGuestMode());
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const checkUserAuth = async ({ markAuthRequired = false } = {}) => {
    setIsLoadingAuth(true);

    try {
      // Always ask the Media God backend instead of relying only on whether an
      // access token happened to arrive in this page URL. This recognises a
      // valid token restored from local storage after reopening the app and
      // also allows the platform to recognise any valid persisted session.
      let currentUser;
      try {
        currentUser = await base44.auth.me();
      } catch (firstError) {
        // Google/Base44 OAuth can restore its persisted session just after a
        // WebView wakes or the app returns from the identity provider. Do not
        // turn one temporary User/me failure into an apparent Google logout.
        // The second check still must authenticate on the backend; never
        // reuse an old user as proof of permission.
        const status = Number(firstError?.status || firstError?.response?.status || 0);
        if (status !== 0 && status !== 401 && status !== 403 &&
            status !== 429 && status < 500) {
          throw firstError;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        currentUser = await base44.auth.me();
      }

      if (!currentUser?.id) {
        const missingSession = new Error('No verified Media God account session');
        missingSession.status = 401;
        throw missingSession;
      }

      setUser(currentUser);
      setIsAuthenticated(true);
      setIsGuest(false);
      writeGuestMode(false);
      setAuthError(null);
      setAuthChecked(true);

      try {
        await hydrateAccountPreferences(currentUser);
      } catch (syncError) {
        console.warn('Account preference hydration failed:', syncError);
      }

      return currentUser;
    } catch (error) {
      const status = Number(error?.status || error?.response?.status || 0);
      const verifiedSessionRejected = status === 401 || status === 403;

      // A timeout, transient network error, or backend 429/5xx does not
      // revoke Google authentication. Preserve the already verified user and
      // let the next foreground/online check restore normal session status.
      // A confirmed 401/403 still removes account-only access.
      if (verifiedSessionRejected) {
        setUser(null);
        setIsAuthenticated(false);
      }
      setAuthChecked(true);

      // The public home catalogue is available when genuinely signed out;
      // private account actions continue requiring a valid server session.
      if (!markAuthRequired && status === 401) {
        setIsGuest(true);
        setAuthError(null);
      } else if (markAuthRequired && verifiedSessionRejected) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      } else if (!verifiedSessionRejected) {
        console.warn('Media God account check temporarily unavailable:', status || 'network');
        // On a first-visit outage only, permit public catalogue browsing.
        // Do not replace a previously signed-in account with guest mode.
        if (!user && !isAuthenticated) {
          setIsGuest(true);
        }
        setAuthError(null);
      }

      return null;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId,
        },
        token: appParams.token,
        interceptResponses: true,
      });

      try {
        const publicSettings = await appClient.get(
          `/prod/public-settings/by-id/${appParams.appId}`
        );

        setAppPublicSettings(publicSettings);

        // Media God is public-with-optional-login. A 401 from /User/me here is
        // a normal signed-out state and should display our own login/register
        // screens, not Base44's workspace-member gate.
        await checkUserAuth({ markAuthRequired: false });
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);

        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;

          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required',
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app',
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message,
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app',
          });
        }

        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    checkAppState();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return installAccountPreferenceSync();
  }, [isAuthenticated]);

  // A lost connection while the mobile app is asleep must not strand a
  // Google user on guest/login indefinitely. Recheck when the device returns,
  // without silently signing in a deliberate Skip-for-now guest.
  useEffect(() => {
    let lastResumeCheck = 0;
    const recoverOnResume = () => {
      if (isAuthenticated || readGuestMode()) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (Date.now() - lastResumeCheck < 8000) return;
      lastResumeCheck = Date.now();
      void checkUserAuth({ markAuthRequired: false });
    };
    window.addEventListener('online', recoverOnResume);
    window.addEventListener('focus', recoverOnResume);
    document.addEventListener('visibilitychange', recoverOnResume);
    return () => {
      window.removeEventListener('online', recoverOnResume);
      window.removeEventListener('focus', recoverOnResume);
      document.removeEventListener('visibilitychange', recoverOnResume);
    };
  }, [isAuthenticated]);



  const continueAsGuest = () => {
    setUser(null);
    setIsAuthenticated(false);
    setIsGuest(true);
    setAuthError(null);
    setAuthChecked(true);
    setIsLoadingAuth(false);
    writeGuestMode(true);
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setIsGuest(false);
    writeGuestMode(false);

    if (shouldRedirect) {
      base44.auth.logout(mediaGodAuthReturnUrl('/login'));
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    if (typeof window !== 'undefined') {
      window.location.assign(mediaGodAuthReturnUrl('/login'));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isGuest,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      continueAsGuest,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
