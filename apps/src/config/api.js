// Resolve the API base URL. Order of precedence:
//   1. EXPO_PUBLIC_API_URL env var (works in expo start + EAS builds).
//   2. extra.apiBaseUrl from app.json — the production Render endpoint
//      by default.
//   3. https://profirmo.onrender.com fallback.
//
// To point a local build at a dev backend on your LAN, set
//   EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:5001
// before running `expo start`.

import Constants from 'expo-constants';

function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const extra =
    (Constants &&
      Constants.expoConfig &&
      Constants.expoConfig.extra &&
      Constants.expoConfig.extra.apiBaseUrl) ||
    (Constants &&
      Constants.manifest &&
      Constants.manifest.extra &&
      Constants.manifest.extra.apiBaseUrl);
  if (extra) return extra;
  return 'https://profirmo.onrender.com';
}

export const API_BASE_URL = resolveBaseUrl();
