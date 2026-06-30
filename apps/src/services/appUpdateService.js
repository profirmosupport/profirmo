// appUpdateService — checks whether a newer version of the mobile
// app is available in the App Store / Play Store and gates the user
// into updating before they can continue.
//
// Source of truth: the live stores themselves, queried directly from
// the device:
//
//   iOS  → https://itunes.apple.com/lookup?bundleId=<bundleId>
//          Apple's public iTunes Lookup API. Returns the latest
//          published version in `results[0].version`. CORS-permitted,
//          no auth required, well-documented.
//
//   Android → https://play.google.com/store/apps/details?id=<package>
//             Google has no official version API. We fetch the public
//             listing HTML and extract the version from the embedded
//             AF_initDataCallback blob (look for the [[["X.Y.Z"]]]
//             pattern). The pattern survives most Play Store
//             redesigns but isn't bulletproof — if Google changes the
//             layout, the regex falls through to null and the gate
//             silently skips rather than crashing.
//
// Decision matrix (per platform) — ALL updates are mandatory:
//   installed >= storeLatest   → no gate
//   installed <  storeLatest   → mandatory "Update required" gate
//                                (no dismiss, no snooze; the only
//                                action is the store button)
//
// The check is best-effort: any failure (network, store unreachable,
// version parse miss, no listing in App Store yet) returns null so
// the user is never blocked from opening the app on a network blip.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const ITUNES_LOOKUP_BASE = 'https://itunes.apple.com/lookup';
const PLAY_STORE_BASE = 'https://play.google.com/store/apps/details';

// Pulled from app.json's `expo.version` at build time. Survives the
// expo-config → manifest fallback on bare workflow.
export function getInstalledVersion() {
  const cfg = Constants.expoConfig || Constants.manifest || {};
  return cfg.version || '0.0.0';
}

// Read the platform-specific app id (bundle on iOS, package on
// Android) from the same source. Hard-coded fallback matches
// app.json so a stripped-down Constants object still works.
function getAppId() {
  const cfg = Constants.expoConfig || Constants.manifest || {};
  if (Platform.OS === 'ios') {
    return (cfg.ios && cfg.ios.bundleIdentifier) || 'com.profirmo.app';
  }
  return (cfg.android && cfg.android.package) || 'com.profirmo.app';
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

// Hit iTunes Lookup with a hard 6s timeout. Returns { version, storeUrl }
// or null when the app isn't published / the request fails.
async function fetchIosLatest(bundleId) {
  const url = `${ITUNES_LOOKUP_BASE}?bundleId=${encodeURIComponent(bundleId)}`;
  const json = await fetchJsonWithTimeout(url, 6000);
  const first = json && Array.isArray(json.results) && json.results[0];
  if (!first || !first.version) return null;
  return {
    version: String(first.version),
    storeUrl:
      first.trackViewUrl ||
      `https://apps.apple.com/app/id${first.trackId || ''}`,
  };
}

// Scrape the Play Store listing HTML. Google embeds the published
// version in an AF_initDataCallback blob; the version is the first
// match for the pattern `[[["X.Y.Z"]]` (sometimes `[[["X.Y.Z.W"]]`).
// If Google rewrites the page, the regex falls through to null and
// we silently skip — better than a crash on every cold start.
async function fetchAndroidLatest(packageName) {
  const url = `${PLAY_STORE_BASE}?id=${encodeURIComponent(packageName)}&hl=en&gl=US`;
  const html = await fetchTextWithTimeout(url, 6000, {
    headers: {
      // A plain UA prevents Google from serving the lite/no-JS
      // variant which doesn't include the version blob.
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!html) return null;
  const match = html.match(/\[\[\["(\d+(?:\.\d+){1,3})"\]\]/);
  if (!match) return null;
  return {
    version: match[1],
    storeUrl: `${PLAY_STORE_BASE}?id=${encodeURIComponent(packageName)}`,
  };
}

function fetchWithTimeout(url, timeoutMs, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function fetchJsonWithTimeout(url, timeoutMs, opts) {
  try {
    const res = await fetchWithTimeout(url, timeoutMs, opts);
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchTextWithTimeout(url, timeoutMs, opts) {
  try {
    const res = await fetchWithTimeout(url, timeoutMs, opts);
    if (!res || !res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Runs at app start. Asks the live store for the latest version and
 * decides whether the device needs to be force-updated. Returns null
 * on any error (network, store unreachable, app not published yet)
 * so a flaky network never blocks the app from opening — the gate
 * only triggers when we have a definitive newer version.
 *
 * Shape on a required update:
 *   {
 *     kind: 'force',
 *     installed: '0.1.0',
 *     latest:    '0.1.7',
 *     storeUrl:  'https://play.google.com/store/apps/details?id=com.profirmo.app',
 *   }
 */
export async function evaluateUpdate() {
  const installed = getInstalledVersion();
  const appId = getAppId();
  let info = null;
  if (Platform.OS === 'ios') {
    info = await fetchIosLatest(appId);
  } else if (Platform.OS === 'android') {
    info = await fetchAndroidLatest(appId);
  }
  if (!info || !info.version || !info.storeUrl) return null;
  if (compareVersion(installed, info.version) >= 0) return null;
  return {
    kind: 'force',
    installed,
    latest: info.version,
    storeUrl: info.storeUrl,
  };
}
