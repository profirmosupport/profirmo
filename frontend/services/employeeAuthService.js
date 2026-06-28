'use client';

// Employee auth client — talks to /api/employee/*. Mirrors the shape
// of the User-side authService but keeps its token under a separate
// localStorage key so the two sessions don't clobber each other.

import { getApiBaseUrl } from '@/services/api';

const TOKEN_KEY = 'pf.employee.access';
const EMP_KEY = 'pf.employee.profile';

function unwrap(json) {
  if (!json) return null;
  if (json.success === false) {
    const err = new Error(json.message || 'Request failed');
    if (json.code) err.code = json.code;
    throw err;
  }
  return json.data === undefined ? json : json.data;
}

export async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getEmployeeToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Unable to reach the server. Please check your connection.');
  }
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    /* keep null */
  }
  if (!res.ok) {
    const msg =
      (payload && payload.message) ||
      `Request failed with status ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    if (payload && payload.code) err.code = payload.code;
    throw err;
  }
  return unwrap(payload);
}

export function getEmployeeToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY) || null;
}

export function getEmployeeProfile() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(EMP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistSession({ accessToken, employee }) {
  if (typeof window === 'undefined') return;
  if (accessToken) window.localStorage.setItem(TOKEN_KEY, accessToken);
  if (employee) {
    window.localStorage.setItem(EMP_KEY, JSON.stringify(employee));
  }
}

export function clearEmployeeSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(EMP_KEY);
}

// --- Signup --------------------------------------------------------------
export function employeeSignup(payload) {
  return request('/api/employee/signup', { method: 'POST', body: payload });
}
export function employeeResendSignupOtp(phone) {
  return request('/api/employee/signup/resend-otp', {
    method: 'POST',
    body: { phone },
  });
}
export async function employeeVerifySignupOtp(payload) {
  const out = await request('/api/employee/signup/verify-otp', {
    method: 'POST',
    body: payload,
  });
  if (out) persistSession(out);
  return out;
}

// --- Login (password OR OTP) --------------------------------------------
export async function employeeLogin({ identifier, password }) {
  const out = await request('/api/employee/login', {
    method: 'POST',
    body: { identifier, password },
  });
  if (out) persistSession(out);
  return out;
}
export function employeeSendLoginOtp(phone) {
  return request('/api/employee/login/otp/send', {
    method: 'POST',
    body: { phone },
  });
}
export async function employeeVerifyLoginOtp(payload) {
  const out = await request('/api/employee/login/otp/verify', {
    method: 'POST',
    body: payload,
  });
  if (out) persistSession(out);
  return out;
}

// --- Read self ---------------------------------------------------------
export function employeeGetMe() {
  return request('/api/employee/me', { auth: true });
}
