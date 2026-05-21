// Authentication service — wraps the /api/auth endpoints.

import { get, post } from '@/services/api';
import { API_ENDPOINTS } from '@/utils/constants';

/**
 * Log in with email + password.
 * @returns {Promise<{success,data:{token,user}}>}
 */
export function login(email, password) {
  return post(API_ENDPOINTS.auth.login, { email, password });
}

/**
 * Register a new client account.
 */
export function registerClient(data) {
  return post(API_ENDPOINTS.auth.registerClient, data);
}

/**
 * Register a new independent professional account.
 */
export function registerProfessional(data) {
  return post(API_ENDPOINTS.auth.registerProfessional, data);
}

/**
 * Register a new firm (creates the firm admin account).
 */
export function registerFirm(data) {
  return post(API_ENDPOINTS.auth.registerFirm, data);
}

/**
 * Fetch the currently authenticated user using a bearer token.
 */
export function getMe(token) {
  return get(API_ENDPOINTS.auth.me, { token });
}

export default {
  login,
  registerClient,
  registerProfessional,
  registerFirm,
  getMe,
};
