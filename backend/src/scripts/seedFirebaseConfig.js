// One-shot seeder for Firebase settings.
//
// Inserts (or overwrites) the 5 Firebase settings we can derive from the
// service-account JSON the admin shared:
//   - firebaseProjectId
//   - firebaseClientEmail
//   - firebasePrivateKey  (the FULL "-----BEGIN PRIVATE KEY-----..." block)
//   - firebaseAuthDomain     <project_id>.firebaseapp.com
//   - firebaseStorageBucket  <project_id>.appspot.com
//
// The remaining three (firebaseApiKey, firebaseMessagingSenderId,
// firebaseAppId) live in the Web App SDK config — they MUST be added from
// the Firebase Console → Project Settings → Your apps → Web app → SDK setup,
// either via this script (extend SERVICE_ACCOUNT.webApp below) or via the
// admin panel at /admin/settings.
//
// adminSettingsService.set() validates + writes, and on a firebase-admin key
// change it also calls firebase.reset() so the running server picks up the
// new credentials without a restart.

require('dotenv').config();

const adminSettingsService = require('../services/adminSettingsService');
const { sequelize } = require('../models');

// Paste the contents of your service-account JSON below. The defaults here
// are the values from the JSON the admin shared on 2026-05-30.
const SERVICE_ACCOUNT = {
  project_id: 'profirmo-66fb5',
  client_email:
    'firebase-adminsdk-fbsvc@profirmo-66fb5.iam.gserviceaccount.com',
  private_key:
    '-----BEGIN PRIVATE KEY-----\n' +
    'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDMdVNjNlvEmXrO\n' +
    'N9dNblBjnI1KLDxlRaxuGU3iAq4I2xMY1fv7jcQ2ELSSs0kvy1BfQGcXA1K2gqYW\n' +
    '6BMXA4KdLLYBnEthAO7cqZDSytPg+Evo1DFb/x8Bejwr4PWJ547Ue/VVU/mfkB/+\n' +
    'gcTHLgJM8n7eG6v8xXyfR6pZUpoARwWq6L/AznOBzXurzuuQCdJAgHaMDWCwkLHW\n' +
    'qeV7wji+EJ7ZfwUluJiQ5J5ymK/BQtoh9ot5z7LQ+MeEK+Qat4Kuufl3tT2H5L16\n' +
    '7onmkwupbtnxxysBn4T9hvU8jFaXDrPSPkwGNDGQmdTGa+Wzm9uR8kTrf11phPcc\n' +
    'l3OpwiPTAgMBAAECggEARt1ngJyno/W6Xd1272yLymrJgerhKAzFHggBOZPKNGGS\n' +
    'Nep9Awx49HBH1gz0Ee+7NLiCwrQxJ/cSkB/x9ekOjWGg1+APNFj5cVwISTdpxrDo\n' +
    'xpM9ZHCBk6aFUoQPNrQeikFIoEGR5J80p6bcyFiHDZqDJIKc0ui0MBTL01fQ7sUP\n' +
    'pAxEhTdfnwV42jENq8AV6L5Tkf54P8nABRJjkoR/GMUCU5dCrFuCD4yTuYMeeMdZ\n' +
    'vbdnIdhvcat2BG/YRZm+4lQc9tgiVH2vLe9YzTmqmOBrpmPOisRKbK5aERf6fgA/\n' +
    'mwUwKPGoP3kn0BVe9xOMgUxYt2KAy+MvmVSHKxxt4QKBgQD9UWmUl+thy/VGglnj\n' +
    'ojFsE0A/7DO56MmbKjWTxIfeaU42r/MR0GmBNuTnLrec4twFVNvLXYNKGo0xhOaE\n' +
    'yoo6rou7AxYFGFxPCwi+J9+Qozu7xD8xCT5fmjEmLLLJtSKqyojxDyXCjw/KxKe9\n' +
    'BtaM4Kt7gfuKHfr1ctQzN6j+0QKBgQDOn3wqEoReVMkYjQ1Nep9o/weQ/uENnfRU\n' +
    'MBK2hxe2hHQFuPxYF5SlPcV68leFwdWCR+bXlVUyScQ0xXIbSCzHp/g+5UPuSGFo\n' +
    'JDOp82UN1WChvznGKpy0z7u/5gxtm7ZZWVcIsSOKUr81SAWajdb+sBhGY6El6WNb\n' +
    'G6U+wl5JYwKBgQCFQU1kAGKvCGaXV7zHdSvAaYQT3EH9mwpq2FJk0C6U/hpJxFb+\n' +
    'WP8XHPRe9IFcQy5wk4onuaJ12e/KS9ojopQCeI1CrEXqGj18yxYnSbxeTq/+fyaq\n' +
    'ue0Yx3jxVvQaDXIWHALbpBc9+JnbFYYTdsRoSUuL5f2XU1wPv/8GjlIU8QKBgHK9\n' +
    '6kvK4Ksp1krF+b8u+1tpVKBWik/viYE++QVX2/lFcNDEu42H+soQlZwC/EuRKqog\n' +
    'l7bcfOViRY0woH86A3QUeS0kUCcBFuaoQ/B684FNH05zTPgZLdDTE2YrsHcl44uW\n' +
    'q1huVlg4P2qtRj9fySbCT5i3NwRAqSYtIgTKF2YVAoGBANenmaF97JvIPdVzZ6ZT\n' +
    'bmnB34YgaQ7/RepoafpN5O2Z/IRgWiPDWfx6e6M//aWrSrdZfpklSdrT8pTBE6v/\n' +
    'tBQ7KZ2ezIQloz1sCdIL2OKZ3oO8iYG9yf0yAuJ9XqRhS2KL9f44F3UreeNvMgHQ\n' +
    'V8xEORR3Ns/9m6byZ5+cnFTW\n' +
    '-----END PRIVATE KEY-----\n',
};

// Web-SDK fields — fill these in after copying from Firebase Console.
// Leaving them as empty strings means the seeder skips them (idempotent).
const WEB_APP = {
  apiKey: '',
  messagingSenderId: '',
  appId: '',
};

async function run() {
  await sequelize.authenticate();
  console.log('[firebaseSeed] DB connected.');

  const pid = SERVICE_ACCOUNT.project_id;
  const pairs = [
    ['firebaseProjectId', pid],
    ['firebaseClientEmail', SERVICE_ACCOUNT.client_email],
    ['firebasePrivateKey', SERVICE_ACCOUNT.private_key],
    ['firebaseAuthDomain', `${pid}.firebaseapp.com`],
    ['firebaseStorageBucket', `${pid}.appspot.com`],
    // Web-SDK keys only when filled in.
    ['firebaseApiKey', WEB_APP.apiKey],
    ['firebaseMessagingSenderId', WEB_APP.messagingSenderId],
    ['firebaseAppId', WEB_APP.appId],
  ];

  let written = 0;
  let skipped = 0;
  for (const [key, value] of pairs) {
    if (!value) {
      console.log(`[firebaseSeed] skip ${key} (empty)`);
      skipped += 1;
      continue;
    }
    await adminSettingsService.set(key, value, null);
    // For the secret key, never echo bytes — just confirm length.
    const summary =
      key === 'firebasePrivateKey'
        ? `(${String(value).length} chars)`
        : String(value);
    console.log(`[firebaseSeed] saved ${key.padEnd(28)} = ${summary}`);
    written += 1;
  }

  console.log(
    `\n[firebaseSeed] done. written=${written} skipped=${skipped} (skipped need to be added from the Firebase Console).`
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[firebaseSeed] failed:', err.message);
    process.exit(1);
  });
