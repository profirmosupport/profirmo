// assetPreloader — fires asset downloads on cold-start so images that
// gate the first visible screen (welcome hero, etc.) are already
// decoded by the time the user reaches them. Keeps the splash visible
// just long enough to hide any first-frame asset flicker.

import { Asset } from 'expo-asset';

const HERO_BUNDLE_IDS = [
  // The welcome screen's full-bleed hero. Anything else that should
  // be ready before first paint can be appended here.
  require('../assets/signup-hero.jpg'),
];

let _started = false;
let _ready = false;
let _promise = null;

export function ensureAssetsReady() {
  if (_promise) return _promise;
  _started = true;
  _promise = Promise.all(
    HERO_BUNDLE_IDS.map((mod) =>
      Asset.fromModule(mod).downloadAsync().catch(() => null)
    )
  ).then(() => {
    _ready = true;
  });
  return _promise;
}

export function assetsReady() {
  return _ready;
}

export function assetsStarted() {
  return _started;
}
