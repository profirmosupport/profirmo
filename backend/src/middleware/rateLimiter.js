// Rate-limiting middleware for the Profirmo backend (Phase 5).
//
// Uses express-rate-limit with the in-memory store. Two limiters are
// exported:
//   - globalLimiter: a generous cap applied to ALL /api routes, intended to
//     soak up abusive bursts without affecting normal traffic.
//   - authLimiter: a much stricter cap applied to brute-force-prone
//     endpoints (login / signup / register-*). It is deliberately NOT used
//     on /api/auth/refresh, which the frontend calls on every app load.
//
// Every limiter responds with the standard { success, message } JSON
// envelope so clients get a consistent error shape.

const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

// Shared JSON handler so a rate-limited request still returns the standard
// error envelope instead of express-rate-limit's default plain-text body.
const jsonHandler = (message) => (req, res /* , next, options */) => {
  res.status(429).json({ success: false, message });
};

// Loopback / local-network requests are skipped entirely in dev so the
// dashboards (which fan out 5+ parallel calls on every refresh) don't
// trigger the limiter during iteration. Production keeps the cap.
const skipLocalDev = (req) => {
  if (isProd) return false;
  const ip = (req.ip || req.connection?.remoteAddress || '').replace(
    /^::ffff:/,
    ''
  );
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.')
  );
};

// Generous, app-wide limiter. 600 requests / 15 minutes per IP in
// production; 5000 in dev so a fast iteration loop doesn't tarpit
// itself. Dev also skips loopback / LAN entirely (see skipLocalDev).
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 600 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  handler: jsonHandler('Too many requests, please try again later.'),
  skip: skipLocalDev,
});

// Strict limiter for authentication endpoints. 30 attempts / 15 minutes
// per IP in production — enough for a real user, hostile to
// credential-stuffing. Dev bumps to 500 and skips loopback / LAN.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  handler: jsonHandler(
    'Too many authentication attempts, please try again later.'
  ),
  skip: skipLocalDev,
});

module.exports = { globalLimiter, authLimiter };
