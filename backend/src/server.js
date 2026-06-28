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
  // Newsletter subscribers — no FK dependency.
  db.NewsletterSubscriber,
  // Support tickets — no FK dependency (userId is loose).
  db.SupportTicket,
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
  // --- Phone-OTP table ------------------------------------------------
  // Powers SMS-OTP login + signup + change-phone. No FK — `phone` is a
  // plain indexed column. Same shape regardless of which flow issued it.
  db.PhoneOtpCode,
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
  // Admin-managed enum of court case statuses. No FKs — `value` is the
  // stable code referenced from other rows as a plain string. Same
  // shape for the sibling case-type + cause-list-type lookups.
  db.CaseStatus,
  db.CaseType,
  db.CauseListType,
  // --- Sales pipeline -------------------------------------------------
  // Lead -> Opportunity -> User(client). LeadActivity is polymorphic on
  // (entityType, entityId), no FK constraint declared.
  db.Lead,
  db.Opportunity,
  db.LeadActivity,
  // --- Payment domain -------------------------------------------------
  // Payment references bookings + users. EscrowEntry references Payment.
  // WalletTransaction and PayoutRequest reference users (already above).
  db.Payment,
  db.EscrowEntry,
  db.WalletTransaction,
  db.PayoutRequest,
  db.BookingNote,
  db.AdminSetting,
  // --- Blog -----------------------------------------------------------
  // Categories + tags are referenced via JSON columns on BlogPost (soft
  // links, no FK constraints), so the strict parent-first ordering only
  // matters for consistency.
  db.BlogCategory,
  db.BlogTag,
  db.BlogPost,
  // --- Subscription management ---------------------------------------
  // Plan must exist before the per-plan feature rules and per-professional
  // subscription rows that reference it; subscriptions before payments.
  db.SubscriptionPlan,
  db.SubscriptionFeatureRule,
  db.ProfessionalSubscription,
  db.SubscriptionPayment,
  // E-Courts India bookmarks — no FK dependency, plain user_id index.
  db.ECourtsFavorite,
  // --- Employee module: field agents who onboard professionals -------
  // Employee is independent of User; commissions + payouts reference
  // it. Professional onboarded by an employee carries employeeId /
  // employeeCode columns on ProfessionalDetail (additive migration).
  db.Employee,
  db.EmployeeCommission,
  db.EmployeePayout,
  // Professional dashboard calendar reminders — soft links (no FKs) to
  // bookings + cases, so order vs. those tables doesn't matter, but it
  // does need to exist for the calendar widget to load.
  db.ProfessionalReminder,
  // Case-scoped tasks. Soft link to Case + User (assignee). Must come
  // after Case + User in this list — both already declared above.
  db.CaseTask,
  // Per-user Gmail OAuth grants.
  db.GmailConnection,
  // Manual pins from a Gmail message to a specific case (multi-case
  // clients disambiguation).
  db.GmailMessageLink,
  // Per-user small UI preferences (kv store).
  db.UserPreference,
  // Tax / legal compliance: per-client entity profile drives the rule
  // generator; obligations are the resulting per-period due-date rows.
  db.ClientComplianceProfile,
  db.ComplianceObligation,
  // Per-client document store + the per-pro access permission rows.
  db.ClientDocument,
  db.ClientDocumentAccess,
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
