const fs = require('fs');
const app = require('./app');
const env = require('./config/env');
const db = require('./models');
const { seedDatabase } = require('./data/seed');
const { runMigrations } = require('./data/migrate');
const { startWorker } = require('./jobs/worker');

// Ensure the local-disk uploads directory exists before the server boots
// (Phase 4). Created recursively so a fresh checkout works out of the box.
fs.mkdirSync(env.uploadsDir, { recursive: true });

// Tables are created parents-first so the foreign-key constraints resolve.
// Session is created right after User (its parent table).
const SYNC_ORDER = [
  db.Firm,
  db.Professional,
  db.User,
  // Phase-5 audit log — no FK dependency, placed right after User.
  db.AuditLog,
  db.Upload,
  db.Session,
  db.Booking,
  db.Case,
  db.Consultation,
  db.Review,
  // ReviewAppeal references reviews — created right after Review.
  db.ReviewAppeal,
  // Case notes + log + updates reference cases.
  db.CaseNote,
  db.CaseLog,
  db.CaseUpdate,
  db.File,
  // --- Phase-2 profile / firm tables, parents-first --------------------
  db.Address,
  db.ProfessionalDetail,
  db.LawFirm,
  db.LawyerDetail,
  db.TechConsultantDetail,
  db.FirmMember,
  // --- Phase-6 background jobs + notifications -------------------------
  // Job has no FK dependency. Notification references users, so it is
  // created after User (already above).
  db.Job,
  db.Notification,
  // --- Phase-7 dynamic professional registration + approval -----------
  // TaxConsultantDetail references professional_details (already above);
  // ProfessionalApproval references users (already above).
  db.TaxConsultantDetail,
  db.ProfessionalApproval,
  // --- Phase-8 firm approval workflow + invitations -------------------
  // Both reference law_firms (already above).
  db.FirmApproval,
  db.FirmInvitation,
  // FirmJoinRequest references law_firms (already above).
  db.FirmJoinRequest,
  // --- Password-reset OTP table --------------------------------------
  // No FK dependency — userId / email are plain indexed columns.
  db.PasswordResetOtp,
  // Link table between professionals and client-users (many-to-many).
  db.ProfessionalClient,
  // --- App settings taxonomy ------------------------------------------
  // Category is the parent of SubCategory; Country is the parent of State,
  // State is the parent of City. Created parents-first.
  db.Category,
  db.SubCategory,
  db.Country,
  db.State,
  db.City,
  // --- Sales pipeline -------------------------------------------------
  // Lead -> Opportunity -> User(client). LeadActivity is polymorphic on
  // (entityType, entityId), no FK constraint declared.
  db.Lead,
  db.Opportunity,
  db.LeadActivity,
];

// Boot the Profirmo HTTP server.
//
// Startup sequence:
//   1. Connect to MySQL (sequelize.authenticate).
//   2. Run additive schema migrations (new columns + backfill).
//   3. Create any missing tables, parents-first (no force, no alter).
//   4. Seed demo data when the database is empty.
//   5. Start listening for HTTP requests.
// A database connection failure is fatal: log clearly and exit.
async function start() {
  try {
    await db.sequelize.authenticate();
    console.log('[DB] Connection established successfully.');

    await runMigrations();

    for (const model of SYNC_ORDER) {
      await model.sync();
    }
    console.log('[DB] Tables synchronized.');

    await seedDatabase();
  } catch (err) {
    console.error('[DB] Failed to initialize database:');
    console.error(err.message || err);
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log('========================================');
    console.log('  Profirmo API');
    console.log(`  Mode:    ${env.nodeEnv}`);
    console.log(`  Port:    ${env.port}`);
    console.log(`  DB:      ${env.db.name}@${env.db.host}:${env.db.port}`);
    console.log(`  Health:  http://localhost:${env.port}/api/health`);
    console.log('========================================');

    // Start the background-job worker once the HTTP server is up. Handler
    // errors are caught inside the worker and never crash the process.
    startWorker();
  });
}

start();
