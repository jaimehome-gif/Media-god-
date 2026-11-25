import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  hydrateAccountPreferences,
  installAccountPreferenceSync,
} from '@/lib/accountPreferenceSync';

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

  const authGeneration = useRef(0);
  const [retryNeeded, setRetryNeeded] = useState(false);

  const checkUserAuth = async ({ markAuthRequired = false } = {}) => {
    const generation = ++authGeneration.current;
    const session = base44.auth.getAccessToken();
    const currentCheck = () => generation === authGeneration.current && session === base44.auth.getAccessToken();
    if (!session) setIsLoadingAuth(true);

    try {
      // Always ask the Media God backend instead of relying only on whether an
      // access token happened to arrive in this page URL. This recognises a
      // valid token restored from local storage after reopening the app and
      // also allows the platform to recognise any valid persisted session.
      const currentUser = await base44.auth.me();

      if (!currentCheck()) return null;
      setRetryNeeded(false);
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
      if (!currentCheck()) return null;
      if (error?.status !== 401 && error?.status !== 403 && base44.auth.getAccessToken()) {
        setRetryNeeded(true);
        setAuthError(null);
        setAuthChecked(true);
        if (!user) setIsGuest(true);
        return null;
      }
      setRetryNeeded(false);
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);

      // The public home catalogue is available as soon as a signed-out
      // visitor arrives. Account-only operations still require a real session.
      if (!markAuthRequired && error?.status === 401) {
        setIsGuest(true);
        setAuthError(null);
      } else if (markAuthRequired && (error?.status === 401 || error?.status === 403)) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      } else if (error?.status !== 401 && error?.status !== 403) {
        console.error('User auth check failed:', error);
      }

      return null;
    } finally {
      if (generation === authGeneration.current) setIsLoadingAuth(false);
    }
  };

  const checkAppState = async () => {
    // Independent Jaime Home identity: no old Base44 public-settings or
    // workspace-member gate. The public catalogue is always accessible.
    setIsLoadingPublicSettings(false);
    setAppPublicSettings({ is_public: true });
    await checkUserAuth({ markAuthRequired: false });
  };

  useEffect(() => {
    checkAppState();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return installAccountPreferenceSync();
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!retryNeeded) return;
    const retry = () => {
      if (!document.hidden && navigator.onLine) void checkUserAuth();
    };
    const timer = window.setInterval(retry, 30000);
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, [retryNeeded]);

  const continueAsGuest = () => {
    authGeneration.current++;
    // Guest UI must not retain an authenticated capability. Logout clears the
    // local session immediately, even if the revocation network call fails.
    void base44.auth.logout();
    setRetryNeeded(false);
    setUser(null);
    setIsAuthenticated(false);
    setIsGuest(true);
    setAuthError(null);
    setAuthChecked(true);
    setIsLoadingAuth(false);
    writeGuestMode(true);
  };

  const logout = (shouldRedirect = true) => {
    authGeneration.current++;
    setRetryNeeded(false);
    setUser(null);
    setIsAuthenticated(false);
    setIsGuest(false);
    writeGuestMode(false);

    if (shouldRedirect) {
      base44.auth.logout('/login');
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
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
