require('dotenv').config();
const path = require('path');

// --- Frontend origin allow-list --------------------------------------------
// `FRONTEND_URL` may be a single URL or a comma-separated list. The known
// production hosts are always included so the backend hosted at
// profirmo.onrender.com accepts requests from profirmo.com even when the
// env var is missing on the deployment.
const PRODUCTION_FRONTEND_ORIGINS = [
  'https://profirmo.com',
  'https://www.profirmo.com',
];
function parseFrontendUrls(value) {
  const fromEnv = String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set([...fromEnv, ...PRODUCTION_FRONTEND_ORIGINS]);
  // Always allow local dev origins in non-production so a copy-pasted
  // FRONTEND_URL=https://profirmo.com/ doesn't lock localhost out of CORS.
  // The previous behaviour only added localhost when the set was empty,
  // which was the trap.
  if (process.env.NODE_ENV !== 'production') {
    set.add('http://localhost:3000');
    set.add('http://127.0.0.1:3000');
  }
  if (set.size === 0) set.add('http://localhost:3000');
  return [...set];
}
const FRONTEND_URLS = parseFrontendUrls(process.env.FRONTEND_URL);

// Centralized environment configuration for the Profirmo backend.
// All other modules should import config values from here rather than
// reading process.env directly.
module.exports = {
  port: process.env.PORT || 5000,
  // Absolute path to the local-disk uploads directory (Phase 4).
  uploadsDir: path.join(__dirname, '../../uploads'),
  // Maximum accepted upload size in bytes (default 10 MB).
  maxUploadBytes:
    Number(process.env.MAX_UPLOAD_BYTES) || 10 * 1024 * 1024,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Primary frontend URL (for building email links etc.). First entry in the
  // allow-list — env-provided value wins, otherwise localhost dev.
  frontendUrl:
    String(process.env.FRONTEND_URL || '').split(',')[0].trim() ||
    'http://localhost:3000',
  // Full allow-list used by CORS + csrfGuard.
  frontendUrls: FRONTEND_URLS,
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_secret',
  jwtExpiresIn: '7d',
  // Short-lived JWT access token lifetime.
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  // Opaque refresh token / session lifetime in days.
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  // httpOnly refresh-token cookie settings.
  cookie: {
    name: 'pf_refresh',
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'demo_project_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || 'mysql',
    ssl: process.env.DB_SSL === 'true',
  },

  // --- Phase-6: jobs / email / notifications --------------------------------
  // Public base URL of the frontend app, used to build links inside emails
  // (e.g. the email-verification link).
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  // Default "From" header for outgoing emails.
  emailFrom: process.env.EMAIL_FROM || 'Profirmo <no-reply@profirmo.com>',
  // Email delivery mode: 'dev' writes rendered emails to disk, 'smtp' uses a
  // real SMTP transport built from the `smtp` config below.
  emailTransport: process.env.EMAIL_TRANSPORT || 'dev',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: process.env.SMTP_SECURE === 'true',
  },
  // Background-job worker poll interval in milliseconds.
  jobPollMs: Number(process.env.JOB_POLL_MS) || 4000,
  // How long an email-verification token stays valid, in hours.
  emailVerificationExpiryHours:
    Number(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS) || 48,

  // --- Razorpay -----------------------------------------------------------
  // Server-side credentials for Razorpay Standard Checkout. The KEY_ID is
  // also exposed to the frontend via NEXT_PUBLIC_RAZORPAY_KEY_ID; the
  // SECRET must never leave the backend.
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  // Platform commission in basis points (1 bp = 0.01%). 1000 = 10% cut.
  platformFeeBps: Number(process.env.PLATFORM_FEE_BPS) || 1000,

  // --- Blog ---------------------------------------------------------------
  // Featured blog images are written to the frontend's `public/` folder so
  // Next.js serves them as first-class static assets (better Lighthouse +
  // OG scrape success than the backend's /uploads/). Defaults to a sibling
  // path; override BLOG_IMAGE_DIR in production when the two services
  // aren't colocated on disk.
  blogImageDir:
    process.env.BLOG_IMAGE_DIR ||
    require('path').resolve(__dirname, '../../../frontend/public/blog-images'),
  // Public URL prefix the frontend uses to fetch those images. Files
  // written to <blogImageDir>/foo.jpg are served at <blogImageUrlPrefix>/foo.jpg.
  blogImageUrlPrefix: process.env.BLOG_IMAGE_URL_PREFIX || '/blog-images',
};
