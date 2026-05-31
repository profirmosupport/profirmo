// Firebase Admin SDK init.
//
// Used by /api/auth/firebase to verify ID tokens minted by Firebase Phone
// Auth on the client, before issuing our own JWT session.
//
// Resolution order for service-account credentials:
//   1. AdminSetting rows (firebaseProjectId / firebaseClientEmail /
//      firebasePrivateKey) — set via the admin panel UI.
//   2. The three split env vars FIREBASE_PROJECT_ID + _CLIENT_EMAIL +
//      _PRIVATE_KEY (Render / Vercel style).
//   3. A single JSON blob env var FIREBASE_SERVICE_ACCOUNT.
//
// When the admin saves a new value through the settings UI, adminSettings
// service calls `reset()` here so the next verifyIdToken() re-initialises
// against the fresh credentials — no server restart needed.

const admin = require('firebase-admin');

let adminApp = null;
let initError = null;

function parseEnvCredentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return {
        project_id: parsed.project_id,
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      };
    } catch (e) {
      initError = new Error(
        'FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON: ' + e.message
      );
      return null;
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;
  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
}

async function readDbCredentials() {
  // Imported lazily so the firebase module can be required from places that
  // run before the DB connection is established (e.g. early at boot).
  try {
    const adminSettings = require('../services/adminSettingsService');
    const projectId = await adminSettings.getString('firebaseProjectId');
    const clientEmail = await adminSettings.getString('firebaseClientEmail');
    const privateKey = await adminSettings.getString('firebasePrivateKey');
    if (!projectId || !clientEmail || !privateKey) return null;
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    };
  } catch {
    // Table not migrated yet, or DB unreachable — fall back to env.
    return null;
  }
}

function normalisePrivateKey(creds) {
  if (!creds || !creds.private_key) return creds;
  let key = creds.private_key;
  // Render / Vercel envs commonly store the newlines in the private key as
  // literal \n sequences — normalise them to real newlines so the PEM parses.
  if (key.indexOf('\\n') !== -1) key = key.replace(/\\n/g, '\n');
  return { ...creds, private_key: key };
}

async function initIfNeeded() {
  if (adminApp || initError) return;
  let creds = await readDbCredentials();
  if (!creds) creds = parseEnvCredentials();
  creds = normalisePrivateKey(creds);
  if (!creds) {
    initError = new Error(
      'Firebase Admin SDK is not configured. Set it from the admin panel ' +
        '(Platform settings -> Firebase Phone Auth) or via env vars.'
    );
    return;
  }
  try {
    // The default app may already be initialised by a previous reset()
    // /init cycle. Use a fresh named app each reset to avoid the
    // "already exists" SDK error.
    const appName = `profirmo-${Date.now()}`;
    adminApp = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: creds.project_id,
          clientEmail: creds.client_email,
          privateKey: creds.private_key,
        }),
      },
      appName
    );
  } catch (e) {
    initError = e;
  }
}

/**
 * Tear the cached Firebase Admin app down so the next verifyIdToken()
 * re-initialises from the latest credentials. Called by adminSettings
 * after the admin updates one of the firebase* settings.
 */
function reset() {
  if (adminApp) {
    try {
      adminApp.delete();
    } catch {
      /* ignore — deleteApp may throw if the SDK already cleared it */
    }
    adminApp = null;
  }
  initError = null;
}

/**
 * Verify a Firebase ID token. Returns the decoded token on success.
 * Throws a tagged error on configuration / verification failure.
 *
 * @param {string} idToken
 * @returns {Promise<import('firebase-admin').auth.DecodedIdToken>}
 */
async function verifyIdToken(idToken) {
  await initIfNeeded();
  if (initError) {
    const err = new Error(initError.message);
    err.statusCode = 503;
    err.code = 'FIREBASE_NOT_CONFIGURED';
    throw err;
  }
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('Missing Firebase ID token.');
    err.statusCode = 400;
    throw err;
  }
  try {
    return await adminApp.auth().verifyIdToken(idToken);
  } catch (e) {
    const err = new Error('Invalid Firebase ID token.');
    err.statusCode = 401;
    err.cause = e.message;
    throw err;
  }
}

async function isConfigured() {
  await initIfNeeded();
  return !initError;
}

module.exports = { verifyIdToken, isConfigured, reset };
