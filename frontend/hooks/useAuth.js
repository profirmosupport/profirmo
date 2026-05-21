'use client';

// localStorage-backed authentication hook.
// State shape: { user, token, loading }.

import { useState, useEffect, useCallback } from 'react';
import authService from '@/services/authService';

const TOKEN_KEY = 'profirmo_token';
const USER_KEY = 'profirmo_user';

function readStored() {
  if (typeof window === 'undefined') return { token: null, user: null };
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    const rawUser = window.localStorage.getItem(USER_KEY);
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { token: token || null, user };
  } catch {
    return { token: null, user: null };
  }
}

function persist(token, user) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const stored = readStored();
    setToken(stored.token);
    setUser(stored.user);
    setLoading(false);
  }, []);

  // Apply an auth response: store token + user, update state.
  const applyAuth = useCallback((response) => {
    const data = (response && response.data) || response || {};
    const nextToken = data.token || null;
    const nextUser = data.user || null;
    persist(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
    return { token: nextToken, user: nextUser };
  }, []);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      try {
        const res = await authService.login(email, password);
        return applyAuth(res);
      } finally {
        setLoading(false);
      }
    },
    [applyAuth]
  );

  const registerClient = useCallback(
    async (data) => {
      setLoading(true);
      try {
        const res = await authService.registerClient(data);
        return applyAuth(res);
      } finally {
        setLoading(false);
      }
    },
    [applyAuth]
  );

  const registerProfessional = useCallback(
    async (data) => {
      setLoading(true);
      try {
        const res = await authService.registerProfessional(data);
        return applyAuth(res);
      } finally {
        setLoading(false);
      }
    },
    [applyAuth]
  );

  const registerFirm = useCallback(
    async (data) => {
      setLoading(true);
      try {
        const res = await authService.registerFirm(data);
        return applyAuth(res);
      } finally {
        setLoading(false);
      }
    },
    [applyAuth]
  );

  const logout = useCallback(() => {
    persist(null, null);
    setToken(null);
    setUser(null);
  }, []);

  return {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    registerClient,
    registerProfessional,
    registerFirm,
    logout,
  };
}

export default useAuth;
