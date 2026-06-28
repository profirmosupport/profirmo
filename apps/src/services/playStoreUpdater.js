// playStoreUpdater — Android-only wrapper around Google Play's In-App
// Updates API. When a newer build is in the Play Store this lets us
// trigger the native install flow (download in background, then
// prompt-to-restart for FLEXIBLE updates, or full-screen install for
// IMMEDIATE updates) without leaving the app.
//
// The underlying native library is `sp-react-native-in-app-updates`.
// We DELIBERATELY load it lazily through require() inside a try/catch
// so the file is safe to import even when:
//   • Running in Expo Go (no native module linked — call falls through
//     to the JS modal instead).
//   • Running on iOS (Apple has no equivalent API — see comment below).
//   • The native lib hasn't been installed yet (e.g. before the first
//     `expo prebuild` + EAS build).
//
// iOS NOTE: there is no programmatic auto-update on iOS. Apple's
// official guidance is to direct users to the App Store; the only
// "silent" iOS update mechanism is the OS-level toggle at
// Settings → App Store → App Updates → ON, which is a device
// preference outside our control. So this module is a no-op on iOS.

import { Platform } from 'react-native';

/**
 * Attempt a Google Play in-app update flow. Returns a small status
 * object so the caller (AppUpdateGate) knows whether the native
 * pipeline took over or whether to fall through to the JS modal +
 * store-redirect path.
 *
 * @param {object} opts
 * @param {boolean} [opts.force=true] — when true (the default), request
 *   an IMMEDIATE update: full-screen, blocking Play UI that the user
 *   can't dismiss without updating. When false, request a FLEXIBLE
 *   update (background download + restart prompt). Every published
 *   update is mandatory in this app, so we default to IMMEDIATE.
 * @returns {Promise<{ supported: boolean, started: boolean, reason?: string }>}
 */
export async function tryPlayInAppUpdate({ force = true } = {}) {
  if (Platform.OS !== 'android') {
    return { supported: false, started: false, reason: 'platform' };
  }

  let mod;
  try {
    // Lazy require so Metro doesn't try to resolve the native module
    // until this branch actually runs. Inside Expo Go this require
    // throws — caught below — and we cleanly fall back.
    // eslint-disable-next-line global-require
    mod = require('sp-react-native-in-app-updates');
  } catch (err) {
    return {
      supported: false,
      started: false,
      reason: 'native-missing',
    };
  }

  const SpInAppUpdates = (mod && (mod.default || mod)) || null;
  const IAUUpdateKind = mod && mod.IAUUpdateKind;
  if (!SpInAppUpdates || !IAUUpdateKind) {
    return { supported: false, started: false, reason: 'native-missing' };
  }

  try {
    const inApp = new SpInAppUpdates(false /* isDebug */);
    const result = await inApp.checkNeedsUpdate();
    if (!result || !result.shouldUpdate) {
      return { supported: true, started: false, reason: 'no-update' };
    }
    await inApp.startUpdate({
      updateType: force ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE,
    });
    return { supported: true, started: true };
  } catch (err) {
    return {
      supported: true,
      started: false,
      reason: (err && err.message) || 'native-error',
    };
  }
}
