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
  user: 'user',
  // Guest flag — persists "Skip" choice across cold starts so the user
  // doesn't see the welcome screen every launch.
  guest: 'guest',
};
