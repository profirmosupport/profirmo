// Thin AsyncStorage wrapper with namespaced keys. Keeps every persisted
// value behind one helper so we can swap the store later if needed.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'profirmo:';

export async function setItem(key, value) {
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  await AsyncStorage.setItem(PREFIX + key, payload);
}

export async function getItem(key, parse = false) {
  const raw = await AsyncStorage.getItem(PREFIX + key);
  if (raw == null) return null;
  if (!parse) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function removeItem(key) {
  await AsyncStorage.removeItem(PREFIX + key);
}

export const STORAGE_KEYS = {
  accessToken: 'access_token',
  // Long-lived opaque refresh token. The mobile API client posts this
  // back to /api/auth/refresh when the access token 401s, retries the
  // original call with the freshly-minted accessToken, and the user
  // never sees a logout.
  refreshToken: 'refresh_token',
  user: 'user',
  // Guest flag — persists "Skip" choice across cold starts so the user
  // doesn't see the welcome screen every launch.
  guest: 'guest',
  // Intent to resume after authentication completes — e.g. the user
  // tapped "Sign in to pay" on the Booking screen; we store the
  // booking target here and replay the navigation once they're logged
  // in. JSON shape: `{ screen, params, ts }`.
  postAuthIntent: 'post_auth_intent',
};
