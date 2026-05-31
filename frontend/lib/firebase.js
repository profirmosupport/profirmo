// Firebase client initialisation — browser-only, runtime-configured.
//
// The web SDK config (apiKey, authDomain, projectId, …) is fetched from
// the backend's GET /api/auth/firebase-config endpoint, so admins can
// rotate the values from the admin panel without rebuilding the frontend.
// The first fetch is cached for the lifetime of the page.
//
// NEXT_PUBLIC_FIREBASE_* env vars are still honoured as a fallback in case
// the runtime fetch fails (e.g. backend offline, dev without DB).

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { get } from '@/services/api';

function envConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

function isUsableConfig(cfg) {
  return Boolean(cfg && cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
}

let cachedConfig = null;
let configPromise = null;

/**
 * Fetch the Firebase web config from the backend (one-shot, cached).
 * Falls back to env vars if the runtime fetch fails or returns an empty
 * config. Returns null if neither source yields a usable config.
 */
export async function loadFirebaseConfig() {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;
  configPromise = (async () => {
    try {
      const res = await get('/api/auth/firebase-config');
      const data = (res && res.data) || res || null;
      if (data && isUsableConfig(data)) {
        cachedConfig = {
          apiKey: data.apiKey,
          authDomain: data.authDomain,
          projectId: data.projectId,
          storageBucket: data.storageBucket || undefined,
          messagingSenderId: data.messagingSenderId || undefined,
          appId: data.appId,
        };
        return cachedConfig;
      }
    } catch {
      /* fall through to env fallback */
    }
    const env = envConfig();
    if (isUsableConfig(env)) {
      cachedConfig = env;
      return cachedConfig;
    }
    cachedConfig = null;
    return null;
  })();
  return configPromise;
}

/** Synchronous check used by the login UI to choose between OTP and the
 *  "phone sign-in not configured" message. Returns false until
 *  loadFirebaseConfig() has resolved at least once. */
export function firebaseConfigured() {
  return Boolean(cachedConfig && isUsableConfig(cachedConfig));
}

let cachedApp = null;
let cachedAuth = null;

async function getFirebaseAppAsync() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase client is only available in the browser.');
  }
  if (cachedApp) return cachedApp;
  const cfg = await loadFirebaseConfig();
  if (!cfg) {
    throw new Error(
      'Phone sign-in is not configured. Set the Firebase keys in the admin ' +
        'panel (Platform settings → Firebase Phone Auth) or in NEXT_PUBLIC_' +
        'FIREBASE_* env vars.'
    );
  }
  cachedApp = getApps().length ? getApp() : initializeApp(cfg);
  return cachedApp;
}

async function getFirebaseAuthAsync() {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(await getFirebaseAppAsync());
  cachedAuth.languageCode = 'en';
  return cachedAuth;
}

// A RecaptchaVerifier instance generates a single-use token that Firebase
// consumes inside signInWithPhoneNumber(). After one call the token is
// either used (success) or invalidated (failure) — in both cases the next
// call needs a brand-new verifier or Firebase rejects with
// auth/invalid-app-credential. We therefore tear the verifier down after
// every send attempt, not just on explicit "Resend".
let activeVerifier = null;

// Verifier size: 'invisible' is nicer UX but fails silently on some
// browser configurations (strict 3rd-party cookies, privacy extensions,
// Safari ITP), causing INVALID_APP_CREDENTIAL with an empty token. The
// 'normal' fallback renders a visible "I'm not a robot" checkbox the user
// has to tick — uglier but ~100% reliable. Driven by an env flag so the
// admin can toggle without a code change.
const RECAPTCHA_SIZE =
  (typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SIZE) ||
  'normal';

async function freshRecaptchaAsync(containerId) {
  if (typeof window === 'undefined') return null;
  // Defensive: clear any stale instance still bound to the container.
  if (activeVerifier) {
    try {
      activeVerifier.clear();
    } catch {
      /* ignore */
    }
    activeVerifier = null;
  }
  const auth = await getFirebaseAuthAsync();
  activeVerifier = new RecaptchaVerifier(auth, containerId, {
    size: RECAPTCHA_SIZE === 'invisible' ? 'invisible' : 'normal',
  });
  // For 'normal' mode the widget needs to be rendered to the DOM before
  // signInWithPhoneNumber consumes its token. Pre-render now so the user
  // sees the checkbox the moment they hit Send OTP.
  if (RECAPTCHA_SIZE !== 'invisible') {
    try {
      await activeVerifier.render();
    } catch {
      /* render may throw if the container is gone — ignore */
    }
  }
  return activeVerifier;
}

/** Tear the verifier down (on navigate-away or between explicit retries). */
export function clearRecaptcha() {
  if (activeVerifier) {
    try {
      activeVerifier.clear();
    } catch {
      /* ignore — clear() may throw if the element is already gone */
    }
    activeVerifier = null;
  }
}

/**
 * Begin the SMS-OTP flow. `phoneE164` must be in E.164 form.
 * Returns the `ConfirmationResult` object — call .confirm(code) on it.
 *
 * The verifier is always disposed after this call resolves OR throws — the
 * underlying reCAPTCHA token is single-use, so the next attempt must start
 * from a fresh widget to avoid `auth/invalid-app-credential`.
 */
export async function sendPhoneOtp(phoneE164, containerId = 'recaptcha-container') {
  const auth = await getFirebaseAuthAsync();
  const verifier = await freshRecaptchaAsync(containerId);
  try {
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } finally {
    clearRecaptcha();
  }
}

/**
 * Complete a phone-OTP sign-in. Returns the Firebase ID token (a JWT) which
 * the backend then exchanges for our session.
 */
export async function confirmPhoneOtp(confirmationResult, code) {
  const cred = await confirmationResult.confirm(code);
  return cred.user.getIdToken();
}
