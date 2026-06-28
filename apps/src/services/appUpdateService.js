// appUpdateService — checks whether a newer version of the mobile
// app is available in the App Store / Play Store and gates the user
// into updating before they can continue.
//
// Source of truth: the backend's GET /api/app-settings/mobile-version
// endpoint, which returns per-platform { latest, minimum, storeUrl }.
// Configured server-side via env vars so a new release can be cut
// without shipping new mobile code.
//
// Decision matrix (per platform) — ALL updates are mandatory:
//   installed >= latest  → no gate
//   installed <  latest  → mandatory "Update required" gate
//                          (no dismiss, no snooze; the only action is
//                          the store button)
//
// We deliberately treat `latest` as the effective minimum so the
// operator only has to set one env var per platform to force every
// device onto the newest build. The legacy `minimum` field is still
// honoured for backward compat when `latest` is unset.
//
// The store URL is opened via Linking.openURL — the actual install
// happens in the device's native store, the only place an iOS / Android
// app can actually self-update.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiGet, unwrap } from './api';
import { STORAGE_KEYS } from '../utils/storage';

// Pulled from app.json's `expo.version` at build time; survives even
// when running detached (Constants.expoConfig collapses to
// Constants.manifest on bare workflow). Falls back to '0.0.0' if
// neither is available so the comparator stays defensive.
export function getInstalledVersion() {
  const cfg = Constants.expoConfig || Constants.manifest || {};
  return cfg.version || '0.0.0';
}

// Strict semver compare — splits on '.' and compares numeric parts.
// Returns -1 / 0 / 1 like Array.sort's comparator. Non-numeric parts
// are coerced to 0 so a stray pre-release tag doesn't poison the
// comparison (e.g. '0.1.0-beta' is treated as '0.1.0').
export function compareVersion(a, b) {
  const pa = String(a || '0').split('.').map((p) => parseInt(p, 10) || 0);
  const pb = String(b || '0').split('.').map((p) => parseInt(p, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = pa[i] || 0;
    const bi = pb[i] || 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

/**
 * Runs at app start. Pulls the version config from the backend and
 * decides whether the device needs to be force-updated. Returns null
 * on any error (network, missing config, etc.) so a flaky network
 * never blocks the app from opening — the gate only triggers when
 * we have a definitive answer that the user is behind.
 *
 * Shape on a required update:
 *   {
 *     kind: 'force',
 *     installed: '0.1.0',
 *     latest:    '0.2.0',
 *     minimum:   '0.1.0',  // may equal latest when only latest is set
 *     storeUrl:  'https://...',
 *   }
 *
 * Returns null when installed >= the effective minimum (no update
 * needed), when the platform has no config, or when the network
 * lookup fails.
 */
export async function evaluateUpdate() {
  const installed = getInstalledVersion();
  let cfg;
  try {
    const res = await apiGet('/api/app-settings/mobile-version');
    cfg = unwrap(res) || null;
  } catch {
    return null;
  }
  if (!cfg) return null;
  const platformCfg = Platform.OS === 'ios' ? cfg.ios : cfg.android;
  if (!platformCfg) return null;
  const { latest, minimum, storeUrl } = platformCfg;
  if (!storeUrl) return null;

  // `latest` is the effective minimum — every published release is
  // treated as mandatory. The legacy `minimum` field is honoured as
  // a fallback when an operator deploys with only `minimum` set.
  const effectiveMinimum = latest || minimum;
  if (!effectiveMinimum) return null;
  if (compareVersion(installed, effectiveMinimum) >= 0) return null;

  return {
    kind: 'force',
    installed,
    latest: latest || minimum,
    minimum: effectiveMinimum,
    storeUrl,
  };
}

// Re-exported so consumers don't need to import STORAGE_KEYS just to
// reach into storage for the snooze flag.
export { STORAGE_KEYS };
