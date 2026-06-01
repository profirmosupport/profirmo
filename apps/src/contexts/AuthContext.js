// AuthContext — single source of truth for the signed-in user across
// the app. On mount we read the persisted token from AsyncStorage and
// hydrate the user via /api/auth/me, then switch the navigator to the
// role-appropriate stack.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getMe,
  login as loginApi,
  logout as logoutApi,
  signup as signupApi,
} from '../services/authService';
import { registerUnauthorizedHandler } from '../services/api';
import { getItem, removeItem, setItem, STORAGE_KEYS } from '../utils/storage';

const AuthContext = createContext({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getItem(STORAGE_KEYS.accessToken);
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const me = await getMe();
      // /api/auth/me wraps the user in { user } — be defensive.
      const next = me && me.user ? me.user : me;
      setUser(next || null);
      if (next) await setItem(STORAGE_KEYS.user, next);
      return next;
    } catch (err) {
      if (err && err.statusCode === 401) {
        await removeItem(STORAGE_KEYS.accessToken);
        await removeItem(STORAGE_KEYS.user);
        setUser(null);
      }
      return null;
    }
  }, []);

  // Cold start: hydrate cached user first (so the role-aware tabs can
  // render immediately) then revalidate against /me in the background.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = await getItem(STORAGE_KEYS.user, true);
        if (active && cached) setUser(cached);
        await refresh();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  // Wire the API client's 401 callback to clear local session state.
  useEffect(() => {
    registerUnauthorizedHandler(async () => {
      await removeItem(STORAGE_KEYS.accessToken);
      await removeItem(STORAGE_KEYS.user);
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginApi(email, password);
    if (data && data.accessToken) {
      await setItem(STORAGE_KEYS.accessToken, data.accessToken);
    }
    const u = (data && data.user) || (await refresh());
    if (u) {
      setUser(u);
      await setItem(STORAGE_KEYS.user, u);
    }
    return u;
  }, [refresh]);

  const signup = useCallback(async (payload) => {
    const data = await signupApi(payload);
    if (data && data.accessToken) {
      await setItem(STORAGE_KEYS.accessToken, data.accessToken);
    }
    const u = (data && data.user) || (await refresh());
    if (u) {
      setUser(u);
      await setItem(STORAGE_KEYS.user, u);
    }
    return u;
  }, [refresh]);

  const logout = useCallback(async () => {
    await logoutApi();
    await removeItem(STORAGE_KEYS.accessToken);
    await removeItem(STORAGE_KEYS.user);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      refresh,
    }),
    [user, loading, login, signup, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
