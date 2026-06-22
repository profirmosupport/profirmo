const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const env = require('./config/env');
const sequelize = require('./config/database');
const { successResponse } = require('./utils/responseHandler');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const { csrfGuard } = require('./middleware/csrfGuard');
const { sanitizeInput } = require('./middleware/sanitizeInput');

const authRoutes = require('./routes/authRoutes');
const professionalRoutes = require('./routes/professionalRoutes');
const firmRoutes = require('./routes/firmRoutes');
const clientRoutes = require('./routes/clientRoutes');
const caseRoutes = require('./routes/caseRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');
const profileRoutes = require('./routes/profileRoutes');
const lawFirmRoutes = require('./routes/lawFirmRoutes');
const fileRoutes = require('./routes/fileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const {
  perCaseRouter: caseTaskPerCaseRouter,
  flatRouter: caseTaskFlatRouter,
} = require('./routes/caseTaskRoutes');
const auditRoutes = require('./routes/auditRoutes');
const integrationsRoutes = require('./routes/integrationsRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const firmJoinRoutes = require('./routes/firmJoinRoutes');
const appSettingsRoutes = require('./routes/appSettingsRoutes');
const leadRoutes = require('./routes/leadRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const walletRoutes = require('./routes/walletRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const blogRoutes = require('./routes/blogRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const ecourtsRoutes = require('./routes/ecourtsRoutes');
const attestrRoutes = require('./routes/attestrRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const supportRoutes = require('./routes/supportRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const paymentController = require('./controllers/paymentController');

const app = express();

// --- Security & global middleware ------------------------------------------
// Middleware order (Phase 5):
//   helmet -> cors -> cookie-parser -> json -> sanitizeInput -> csrfGuard
//   -> rate limiter -> routers -> static -> error handlers.

// 1. helmet — security response headers. CSP and Cross-Origin-Embedder-Policy
//    are disabled because this is a cross-origin JSON API + static file host,
//    not an HTML site; crossOriginResourcePolicy is set to 'cross-origin' so
//    the separate-origin frontend can embed /uploads images via <img> tags.
//    All other helmet defaults (nosniff, frameguard, HSTS, ...) stay on.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. cors — credentials:true is required so the browser sends/receives the
//    httpOnly refresh-token cookie on cross-origin requests. The allow-list
//    covers local dev, configured FRONTEND_URL(s) and the known production
//    origins (profirmo.com / www.profirmo.com).
const allowedOrigins = new Set(env.frontendUrls);
app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser callers (curl, server-to-server) send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Disallowed origin — pass `false` so cors omits the headers and the
      // browser blocks the response; csrfGuard rejects state-changing calls.
      return callback(null, false);
    },
    credentials: true,
  })
);

// 3. cookie-parser — needed to read the httpOnly refresh-token cookie.
app.use(cookieParser());

// 4a. Razorpay webhook — must run BEFORE the global JSON parser so we can
//     access the raw body bytes for HMAC verification. The handler parses
//     the JSON itself after the signature has been validated.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    try {
      req.rawBody = req.body && req.body.toString ? req.body.toString('utf8') : '';
      req.body = req.rawBody ? JSON.parse(req.rawBody) : {};
    } catch {
      req.body = {};
    }
    next();
  },
  paymentController.webhook
);

// 4. body parsing.
app.use(express.json());

// 5. sanitizeInput — conservative defense-in-depth cleaning of string inputs.
app.use(sanitizeInput);

// 6. csrfGuard — origin check on state-changing requests (with the sameSite
//    httpOnly refresh cookie, this is the CSRF defense).
app.use(csrfGuard);

// Lightweight request logger (development convenience).
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- Base routes -----------------------------------------------------------
app.get('/', (req, res) => {
  res.send('Profirmo API is running');
});

app.get('/api/health', async (req, res) => {
  let database = 'disconnected';
  try {
    await sequelize.authenticate();
    database = 'connected';
  } catch (err) {
    database = 'disconnected';
  }
  // Surface enough config state to diagnose a misconfigured production
  // deploy without having to ssh and grep .env. Secrets are NEVER echoed
  // back — only "set" / "missing" booleans + the public key id prefix
  // (which the frontend bundle already exposes anyway).
  const razorpay = {
    keyIdSet: Boolean(env.razorpay.keyId),
    keySecretSet: Boolean(env.razorpay.keySecret),
    webhookSecretSet: Boolean(env.razorpay.webhookSecret),
    keyIdPrefix: env.razorpay.keyId
      ? `${String(env.razorpay.keyId).slice(0, 8)}…`
      : null,
  };
  razorpay.ready = razorpay.keyIdSet && razorpay.keySecretSet;
  return successResponse(res, 200, 'Backend API is running successfully', {
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    uptime: process.uptime(),
    database,
    razorpay,
  });
});

// --- Feature routers -------------------------------------------------------
// 7. globalLimiter — generous app-wide rate cap applied to every /api route.
app.use('/api', globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/firms', firmRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/law-firm', lawFirmRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/cases/:caseId/tasks', caseTaskPerCaseRouter);
app.use('/api/case-tasks', caseTaskFlatRouter);
app.use('/api/audit', auditRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/firm-join', firmJoinRoutes);
app.use('/api/app-settings', appSettingsRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/ecourts', ecourtsRoutes);
app.use('/api/attestr', attestrRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/employee', employeeRoutes);
// Subscription routes — /api/subscription-plans is public, the rest are
// auth-gated inside the router.
app.use('/api', subscriptionRoutes);

// --- Static uploads --------------------------------------------------------
// Serve files stored on local disk at /uploads/<storedName>. Stored names
// are server-generated UUIDs, so there is no path-traversal surface here.
app.use('/uploads', express.static(env.uploadsDir));

// --- Error handling --------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
