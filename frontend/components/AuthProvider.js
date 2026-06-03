'use client';

// AuthProvider — the single source of truth for authentication state.
//
// Session model:
//  - The httpOnly `pf_refresh` cookie (30-day) is the persistent session. It
//    survives page refresh and browser reopen and is sent automatically by the
//    browser on every request that uses `credentials: 'include'`.
//  - The 15-minute access token lives ONLY in memory (this context + api.js).
//    On app load this provider calls /api/auth/refresh to silently restore the
//    session and obtain a fresh access token.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import authService from '@/services/authService';
import { setAccessToken, registerAuthCallbacks } from '@/services/api';

// localStorage key used purely for an instant first paint of the user card.
// The access token is NEVER stored here — only the (non-sensitive) user shape.
const USER_CACHE_KEY = 'profirmo_user';

const AuthContext = createContext(null);

function readCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    /* storage unavailable — ignore */
  }
}

// Paths the incomplete-signup guard should never redirect away from. Login
// / signup / verify / reset live here so professionals can still complete
// auth flows while bounced; /logout is a no-op route.
const SIGNUP_GUARD_ALLOW = [
  '/signup',
  '/login',
  '/logout',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

export function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [accessToken, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Keep the latest user available to callbacks without re-registering them.
  const userRef = useRef(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Apply an auth response ({ accessToken, token, user }) to state + api.js.
  const applyAuth = useCallback((data) => {
    const payload = data || {};
    const nextToken = payload.accessToken || payload.token || null;
    const nextUser = payload.user || null;
    setToken(nextToken);
    setUser(nextUser);
    setAccessToken(nextToken);
    writeCachedUser(nextUser);
    return nextUser;
  }, []);

  // Clear all auth state everywhere.
  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    setAccessToken(null);
    writeCachedUser(null);
  }, []);

  // Register the api.js callbacks so a background refresh keeps context in sync
  // and an expired session clears state. Done once on mount.
  useEffect(() => {
    registerAuthCallbacks({
      onTokenRefreshed: (newToken, refreshedUser) => {
        setToken(newToken);
        setAccessToken(newToken);
        if (refreshedUser) {
          setUser(refreshedUser);
          writeCachedUser(refreshedUser);
        }
      },
      onAuthExpired: () => {
        clearAuth();
      },
    });
  }, [clearAuth]);

  // Signup-completion guard: if a professional finished only part of the
  // 3-step wizard and bounced (closing the tab, navigating away, logging
  // back in later), force them back to /signup until they finish all
  // three steps. Non-professionals + completed signups pass through.
  useEffect(() => {
    if (loading || !user) return;
    if (user.role !== 'professional') return;
    if (user.signupComplete) return;
    if (!pathname) return;
    if (SIGNUP_GUARD_ALLOW.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return;
    }
    router.replace('/signup?resume=1');
  }, [user, loading, pathname, router]);

  // On mount: paint instantly from cache, then silently restore the session.
  useEffect(() => {
    let active = true;
    const cached = readCachedUser();
    if (cached) setUser(cached);

    (async () => {
      try {
        const data = await authService.refresh();
        if (!active) return;
        applyAuth(data);
      } catch {
        // No / expired session — stay logged out.
        if (!active) return;
        clearAuth();
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [applyAuth, clearAuth]);

  const login = useCallback(
    async (email, password) => {
      const data = await authService.login(email, password);
      return applyAuth(data);
    },
    [applyAuth]
  );

  // Adopt a phone-OTP session. Caller has already verified the OTP via
  // /api/auth/phone/verify-otp (purpose='login') for this phone number.
  const loginWithPhone = useCallback(
    async (phone) => {
      const data = await authService.loginWithPhone(phone);
      return applyAuth(data);
    },
    [applyAuth]
  );

  // Complete phone-first signup. Caller has verified the OTP for the
  // same phone (purpose='signup') and now POSTs the new profile fields;
  // the backend creates the user and returns a session payload.
  const signupWithPhone = useCallback(
    async (payload) => {
      const data = await authService.signupWithPhone(payload);
      return applyAuth(data);
    },
    [applyAuth]
  );

  // Signup no longer logs the user in — email verification is required first.
  // Return the response data ({ user, emailVerificationRequired }) so the
  // signup page can render its "check your email" confirmation screen.
  const signup = useCallback(async (data) => {
    return authService.signup(data);
  }, []);

  // Verify an email with the token from the verification link. On success the
  // backend returns an access token + sets the refresh cookie, so this stores
  // the auth state exactly like `login` does and returns the logged-in user.
  const verifyEmail = useCallback(
    async (token) => {
      const data = await authService.verifyEmail(token);
      return applyAuth(data);
    },
    [applyAuth]
  );

  // Claim a client account: backend issues a session on success, so adopt it
  // the same way verifyEmail does.
  const claimAccount = useCallback(
    async (payload) => {
      const data = await authService.claimAccount(payload);
      return applyAuth(data);
    },
    [applyAuth]
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors — clear local state regardless.
    }
    clearAuth();
    router.push('/home');
  }, [clearAuth, router]);

  // Re-fetch GET /api/auth/me so the header updates when the profile changes.
  const refreshUser = useCallback(async () => {
    try {
      const data = await authService.getMe();
      const nextUser = (data && data.user) || null;
      if (nextUser) {
        setUser(nextUser);
        writeCachedUser(nextUser);
      }
      return nextUser;
    } catch {
      return userRef.current;
    }
  }, []);

  // Backward-compatible register aliases — delegate to signup.
  const registerClient = useCallback(
    (data) => signup({ ...data, role: 'client' }),
    [signup]
  );

  // Professional registration uses the dedicated full-payload endpoint.
  // The backend now issues a session immediately (so the 3-step signup
  // wizard can keep saving Step 2/3 without forcing email verification
  // first). If a token is returned we apply it via `applyAuth` so the
  // wizard's later API calls are authenticated. Email verification still
  // happens via the link in the queued email, just out-of-band.
  const registerProfessional = useCallback(
    async (payload) => {
      const data = await authService.registerProfessional(payload);
      if (data && (data.accessToken || data.token) && data.user) {
        applyAuth({
          user: data.user,
          accessToken: data.accessToken || data.token,
          token: data.accessToken || data.token,
        });
      }
      return data;
    },
    [applyAuth]
  );

  // Firms can no longer sign up directly — a professional registers, then
  // creates the firm from their dashboard. We expose this helper only so
  // existing imports do not crash; calling it throws a clear error.
  const registerFirm = useCallback(async () => {
    throw new Error(
      'Firms cannot sign up directly. Register as a professional and create your firm from the dashboard.'
    );
  }, []);

  const value = {
    user,
    accessToken,
    // Backward-compatible alias for older consumers.
    token: accessToken,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithPhone,
    signupWithPhone,
    signup,
    verifyEmail,
    claimAccount,
    logout,
    refreshUser,
    registerClient,
    registerProfessional,
    registerFirm,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — access the auth context.
 * Returns a safe logged-out shape if used outside the provider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  const noop = async () => {};
  return {
    user: null,
    accessToken: null,
    token: null,
    loading: false,
    isAuthenticated: false,
    login: noop,
    loginWithPhone: noop,
    signupWithPhone: noop,
    signup: noop,
    verifyEmail: noop,
    claimAccount: noop,
    logout: noop,
    refreshUser: noop,
    registerClient: noop,
    registerProfessional: noop,
    registerFirm: noop,
  };
}

export default AuthProvider;
