// Idempotent schema migrations for the Profirmo backend.
//
// runMigrations() applies ADDITIVE changes only: it adds the extended profile
// columns to the existing `users` table and backfills sane values for any
// rows that pre-date those columns. It uses raw SQL (MariaDB `IF NOT EXISTS`)
// so it is safe to run on every boot.

const crypto = require('crypto');
const sequelize = require('../config/database');
const { hashPassword } = require('../utils/password');

// New columns to add to the `users` table: [name, SQL type].
const USER_COLUMNS = [
  ['uuid', 'VARCHAR(255)'],
  ['firstName', 'VARCHAR(255)'],
  ['lastName', 'VARCHAR(255)'],
  ['fullName', 'VARCHAR(255)'],
  ['mobileNumber', 'VARCHAR(255)'],
  ['profilePhoto', 'VARCHAR(255)'],
  ['coverPhoto', 'VARCHAR(255)'],
  ["status", "VARCHAR(255) DEFAULT 'active'"],
  ['isOnline', 'TINYINT(1) DEFAULT 0'],
  ['memberSince', 'DATETIME'],
  ['lastLogin', 'DATETIME'],
  ['accountVerified', 'TINYINT(1) DEFAULT 0'],
  ['emailVerified', 'TINYINT(1) DEFAULT 0'],
  ['mobileVerified', 'TINYINT(1) DEFAULT 0'],
  // --- Phase-6: email-verification columns -------------------------------
  ['emailVerificationTokenHash', 'VARCHAR(255)'],
  ['emailVerificationExpiresAt', 'DATETIME'],
  ['emailVerificationSentAt', 'DATETIME'],
  // --- Phase-10: client unification — clients are users now -------------
  ['city', 'VARCHAR(255)'],
  ["userType", "VARCHAR(64) DEFAULT 'individual'"],
];

// Phase-7 additive columns: { table: [[name, SQL type], ...] }. Existing
// professional-detail tables are extended with the dynamic-registration
// fields. `ADD COLUMN IF NOT EXISTS` keeps this idempotent on every boot.
const PHASE7_COLUMNS = {
  lawyer_specific_details: [
    ['consultationType', 'VARCHAR(255)'],
    ['yearsOfPractice', 'INT'],
    ['advocateLicenseNumber', 'VARCHAR(255)'],
    ['lawDegreeDocument', 'VARCHAR(255)'],
    ['supportingCertificates', 'LONGTEXT'],
  ],
  professional_details: [
    ['consultationFee', 'DECIMAL(10,2)'],
    ['availability', 'LONGTEXT'],
    ['availableNow', 'TINYINT(1) NULL'],
    ['degreeCertificate', 'VARCHAR(255)'],
  ],
};

// Phase-8 additive columns: { table: [[name, SQL type], ...] }. The existing
// `law_firms` table gains a `status` column for the firm-approval workflow.
// `ADD COLUMN IF NOT EXISTS` keeps this idempotent on every boot.
const PHASE8_COLUMNS = {
  law_firms: [['status', "VARCHAR(40) NOT NULL DEFAULT 'PENDING_APPROVAL'"]],
};

// Listing additive columns: { table: [[name, SQL type], ...] }. The
// `professional_details` and `law_firms` tables gain rating / reviewsCount
// columns so the unified listing APIs can surface those values from the
// new user-centric model alongside the legacy seeded tables.
// `ADD COLUMN IF NOT EXISTS` keeps this idempotent on every boot.
const LISTING_COLUMNS = {
  professional_details: [
    ['rating', 'DECIMAL(3,2) DEFAULT 0'],
    ['reviewsCount', 'INT DEFAULT 0'],
    // Admin-curated home-page spotlight flag.
    ['featured', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ],
  law_firms: [
    ['rating', 'DECIMAL(3,2) DEFAULT 0'],
    ['reviewsCount', 'INT DEFAULT 0'],
    ['numberOfProfessionals', 'INT NULL'],
    ['featured', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ],
};

// RFC4122-ish v4 UUID generator (no external dependency).
const genUuid = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20
  )}-${h.slice(20)}`;
};

/**
 * Apply additive schema migrations. Safe to run repeatedly.
 * @returns {Promise<void>}
 */
async function runMigrations() {
  console.log('[Migrate] Starting additive schema migrations...');

  // 1. Add any missing columns to the users table.
  let added = 0;
  for (const [col, type] of USER_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
      added += 1;
    } catch (err) {
      // IF NOT EXISTS makes this idempotent; log unexpected failures only.
      console.warn(`[Migrate] Could not add column ${col}: ${err.message}`);
    }
  }
  console.log(`[Migrate] users column check complete (${added} processed).`);

  // 2. Backfill profile values for rows that pre-date the new columns.
  await sequelize.query(
    "UPDATE users SET fullName = name WHERE fullName IS NULL OR fullName = ''"
  );
  // firstName = first whitespace-delimited token of name.
  await sequelize.query(
    "UPDATE users SET firstName = TRIM(SUBSTRING_INDEX(name, ' ', 1)) " +
      "WHERE (firstName IS NULL OR firstName = '') AND name IS NOT NULL AND name <> ''"
  );
  // lastName = remainder after the first token (empty when name is one word).
  await sequelize.query(
    "UPDATE users SET lastName = TRIM(" +
      "CASE WHEN LOCATE(' ', name) > 0 " +
      "THEN SUBSTRING(name, LOCATE(' ', name) + 1) ELSE '' END) " +
      "WHERE (lastName IS NULL) AND name IS NOT NULL AND name <> ''"
  );
  await sequelize.query(
    'UPDATE users SET memberSince = createdAt WHERE memberSince IS NULL'
  );
  await sequelize.query(
    "UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''"
  );

  // Phase-6: keep every pre-existing user (demo / seed accounts) verified so
  // they can still log in after email verification becomes mandatory for new
  // signups. Only existing rows are touched; new signups start unverified.
  await sequelize.query(
    'UPDATE users SET emailVerified = 1, accountVerified = 1 ' +
      'WHERE emailVerified IS NULL OR emailVerified = 0'
  );

  // 3. Backfill uuid row-by-row (each row needs a distinct value).
  const [rowsNeedingUuid] = await sequelize.query(
    "SELECT id FROM users WHERE uuid IS NULL OR uuid = ''"
  );
  for (const row of rowsNeedingUuid) {
    await sequelize.query('UPDATE users SET uuid = ? WHERE id = ?', {
      replacements: [genUuid(), row.id],
    });
  }

  console.log(
    `[Migrate] Backfill complete. uuid assigned to ${rowsNeedingUuid.length} ` +
      'row(s); fullName/firstName/lastName/memberSince/status normalized.'
  );

  // 4. Phase-7: add the dynamic-registration columns to the existing
  //    professional-detail tables. Wrapped per-column so a table that does
  //    not yet exist (fresh DB — created later by sync()) is skipped quietly.
  let phase7Added = 0;
  for (const [table, columns] of Object.entries(PHASE7_COLUMNS)) {
    for (const [col, type] of columns) {
      try {
        await sequelize.query(
          `ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
        );
        phase7Added += 1;
      } catch (err) {
        // The table may not exist yet on a brand-new database; sync() will
        // create it with the columns already defined on the model.
        console.warn(
          `[Migrate] Could not add ${table}.${col}: ${err.message}`
        );
      }
    }
  }
  console.log(
    `[Migrate] Phase-7 column check complete (${phase7Added} processed).`
  );

  // 4a. 3-step signup unified fields — adds the new columns to
  //     `professional_details` BEFORE any Sequelize-backed phase runs, so
  //     `Professional.findAll` and friends never SELECT a column the DB
  //     doesn't yet have. Idempotent via `ADD COLUMN IF NOT EXISTS`.
  const PRO_DETAIL_3STEP_COLUMNS = [
    ['primaryCategoryId', 'VARCHAR(64)'],
    ['consultancyType', 'VARCHAR(20)'],
    ['courtsPracticing', 'LONGTEXT'],
    ['chamberAddress', 'TEXT'],
    ['licenseNumber', 'VARCHAR(255)'],
    ['barRegistrationNumber', 'VARCHAR(255)'],
    ['taxRegistrationNumber', 'VARCHAR(255)'],
    ['enrollmentNumber', 'VARCHAR(255)'],
    ['advocateLicenseDoc', 'VARCHAR(512)'],
    ['barCouncilCertDoc', 'VARCHAR(512)'],
    ['lawDegreeDoc', 'VARCHAR(512)'],
    ['taxRegistrationCertDoc', 'VARCHAR(512)'],
    ['qualificationCertDoc', 'VARCHAR(512)'],
    ['professionalLicenseDoc', 'VARCHAR(512)'],
    ['governmentIdDoc', 'VARCHAR(512)'],
    ['completionPercent', 'INT NOT NULL DEFAULT 0'],
    ['signupComplete', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ];
  for (const [col, type] of PRO_DETAIL_3STEP_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE \`professional_details\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(
          `[Migrate] Could not add professional_details.${col}: ${err.message}`
        );
      }
    }
  }

  // 5. Phase-8: add the firm-approval `status` column to the existing
  //    `law_firms` table, then backfill pre-existing firms so they do not
  //    block on review (treat firms created before Phase 8 as ACTIVE).
  let phase8Added = 0;
  for (const [table, columns] of Object.entries(PHASE8_COLUMNS)) {
    for (const [col, type] of columns) {
      try {
        await sequelize.query(
          `ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
        );
        phase8Added += 1;
      } catch (err) {
        // The table may not exist yet on a brand-new database; sync() will
        // create it with the column already defined on the model.
        console.warn(
          `[Migrate] Could not add ${table}.${col}: ${err.message}`
        );
      }
    }
  }
  // Backfill: any law_firms row with a NULL/empty status pre-dates Phase 8.
  // Those firms were usable before the workflow existed, so keep them ACTIVE.
  try {
    await sequelize.query(
      "UPDATE law_firms SET status = 'ACTIVE' " +
        "WHERE status IS NULL OR status = ''"
    );
  } catch (err) {
    // law_firms may not exist yet on a brand-new database.
    console.warn(`[Migrate] Could not backfill law_firms.status: ${err.message}`);
  }
  console.log(
    `[Migrate] Phase-8 column check complete (${phase8Added} processed).`
  );

  // 6. Listing: add rating / reviewsCount columns to professional_details
  //    and law_firms so the unified listing APIs can serve those values
  //    from the new user-centric model. Wrapped per-column so a table that
  //    does not yet exist (fresh DB) is skipped quietly; sync() creates it
  //    with the columns already defined on the model.
  let listingAdded = 0;
  for (const [table, columns] of Object.entries(LISTING_COLUMNS)) {
    for (const [col, type] of columns) {
      try {
        await sequelize.query(
          `ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
        );
        listingAdded += 1;
      } catch (err) {
        console.warn(
          `[Migrate] Could not add ${table}.${col}: ${err.message}`
        );
      }
    }
  }
  console.log(
    `[Migrate] Listing column check complete (${listingAdded} processed).`
  );

  // 7. Reviews: add `userId` (the authenticated reviewer) and `status` so a
  //    review can be tied to a user account and hidden while under appeal.
  const REVIEW_COLUMNS = [
    ['userId', 'VARCHAR(64)'],
    ['status', "VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'"],
  ];
  let reviewAdded = 0;
  for (const [col, type] of REVIEW_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE \`reviews\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
      reviewAdded += 1;
    } catch (err) {
      console.warn(`[Migrate] Could not add reviews.${col}: ${err.message}`);
    }
  }
  // Treat every pre-existing review as published.
  try {
    await sequelize.query(
      "UPDATE reviews SET status = 'PUBLISHED' " +
        "WHERE status IS NULL OR status = ''"
    );
  } catch (err) {
    console.warn(
      `[Migrate] Could not backfill reviews.status: ${err.message}`
    );
  }
  console.log(
    `[Migrate] Review column check complete (${reviewAdded} processed).`
  );

  // 7a. Descriptive case columns (priority, court info, next hearing, assigned-by).
  const CASE_COLUMNS = [
    ['priority', "VARCHAR(20) NOT NULL DEFAULT 'medium'"],
    ['caseNumber', 'VARCHAR(255)'],
    ['courtName', 'VARCHAR(255)'],
    ['opposingParty', 'VARCHAR(255)'],
    ['nextHearingDate', 'DATE'],
    ['assignedByUserId', 'VARCHAR(64)'],
    ['assignedAt', 'DATETIME'],
    // Multi-client support: JSON array of users.id values. The primary
    // `clientId` column stays for back-compat (= clientIds[0]).
    ['clientIds', 'LONGTEXT'],
    // Multi-assignee support: JSON array of public professional ids. The
    // primary `professionalId` column stays for back-compat (=
    // professionalIds[0]).
    ['professionalIds', 'LONGTEXT'],
  ];
  let caseColsAdded = 0;
  for (const [col, type] of CASE_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE \`cases\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
      caseColsAdded += 1;
    } catch (err) {
      console.warn(
        `[Migrate] Could not add cases.${col}: ${err.message}`
      );
    }
  }
  console.log(
    `[Migrate] Case column check complete (${caseColsAdded} processed).`
  );

  // 7c. Files: optional link to a CaseUpdate, plus a `url` column so the
  //     UI can render attachments without a second round-trip.
  const FILE_COLUMNS = [
    ['caseUpdateId', 'VARCHAR(64)'],
    ['url', 'VARCHAR(512)'],
  ];
  for (const [col, type] of FILE_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE \`files\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      console.warn(`[Migrate] Could not add files.${col}: ${err.message}`);
    }
  }

  // 7d. CaseUpdate `title` column for existing DBs.
  try {
    await sequelize.query(
      'ALTER TABLE `case_updates` ADD COLUMN IF NOT EXISTS `title` VARCHAR(255)'
    );
  } catch (err) {
    // The case_updates table may not exist on a fresh DB yet — sync() will
    // create it with the column already on the model.
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(`[Migrate] Could not add case_updates.title: ${err.message}`);
    }
  }

  // 7c-bis. Case stage tracking — pipeline + step within pipeline,
  // sourced from seeds/compliance-rules.json via config/caseStages.
  // googleHearingEventId mirrors nextHearingDate to Google Calendar.
  const CASE_STAGE_COLUMNS = [
    ['stageType', 'VARCHAR(40) NULL'],
    ['stage', 'VARCHAR(60) NULL'],
    ['stageUpdatedAt', 'DATETIME NULL'],
    ['googleHearingEventId', 'VARCHAR(128) NULL'],
  ];
  for (const [col, type] of CASE_STAGE_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE \`cases\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(`[Migrate] Could not add cases.${col}: ${err.message}`);
      }
    }
  }

  // 7d-bis. CaseUpdate task fields — promotes an update into a task
  // surface (status / priority / dueDate / completedAt). NULLs preserve
  // the pure-narration shape. Drives the dashboard calendar pills.
  const CASE_UPDATE_TASK_COLUMNS = [
    ['status', "ENUM('open','in_progress','done','cancelled') NULL"],
    ['priority', "ENUM('low','normal','high') NULL"],
    ['dueDate', 'DATE NULL'],
    ['completedAt', 'DATETIME NULL'],
    ['completedByUserId', 'VARCHAR(64) NULL'],
    ['googleEventId', 'VARCHAR(128) NULL'],
  ];
  for (const [col, type] of CASE_UPDATE_TASK_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE \`case_updates\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(
          `[Migrate] Could not add case_updates.${col}: ${err.message}`
        );
      }
    }
  }

  // 7e. CaseNote `attachments` JSON column for existing DBs.
  try {
    await sequelize.query(
      'ALTER TABLE `case_notes` ADD COLUMN IF NOT EXISTS `attachments` LONGTEXT'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(`[Migrate] Could not add case_notes.attachments: ${err.message}`);
    }
  }

  // 7j. Case.bookingId — anchors a case back to the booking that produced
  // it so we can enforce "one live case per booking" in the convert-to-case
  // flow. NULL when the case was created manually (firm or admin).
  try {
    await sequelize.query(
      'ALTER TABLE `cases` ADD COLUMN IF NOT EXISTS `bookingId` VARCHAR(64) NULL'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(
        `[Migrate] Could not add cases.bookingId: ${err.message}`
      );
    }
  }

  // 7j. ProfessionalDetail.employeeId / employeeCode — set when a
  // /join-team employee onboards the professional. Used by the
  // employee-commission credit hook on admin approval.
  for (const [col, type] of [
    ['employeeId', 'VARCHAR(64) NULL'],
    ['employeeCode', 'VARCHAR(16) NULL'],
  ]) {
    try {
      await sequelize.query(
        `ALTER TABLE \`professional_details\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(
          `[Migrate] Could not add professional_details.${col}: ${err.message}`
        );
      }
    }
  }

  // 7i. ProfessionalDetail.acceptsOnlineBooking + Booking.completedAt.
  // Both are NULL-safe: NULL on acceptsOnlineBooking means "accepting"
  // (existing pros stay bookable); completedAt is set when a booking flips
  // to status='completed' so the 5-day review window can be evaluated.
  try {
    await sequelize.query(
      'ALTER TABLE `professional_details` ADD COLUMN IF NOT EXISTS `acceptsOnlineBooking` BOOLEAN NULL'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(
        `[Migrate] Could not add professional_details.acceptsOnlineBooking: ${err.message}`
      );
    }
  }
  try {
    await sequelize.query(
      'ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `completedAt` DATETIME NULL'
    );
    // Backfill: any booking that's already 'completed' but missing a
    // completedAt stamp gets one — the 5-day review window anchors against
    // this column, so a missing value would keep escrow locked forever.
    // We use the row's updatedAt as the best approximation of when it was
    // marked completed.
    const [r] = await sequelize.query(
      "UPDATE `bookings` SET `completedAt` = `updatedAt` WHERE `status` = 'completed' AND `completedAt` IS NULL"
    );
    if (r && r.affectedRows > 0) {
      console.log(
        `[Migrate] Backfilled bookings.completedAt for ${r.affectedRows} row(s).`
      );
    }
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(
        `[Migrate] Could not add bookings.completedAt: ${err.message}`
      );
    }
  }

  // 7h. Review extensions: kind / bookingId / reviewedUserId. Lets the same
  // table hold three review types — client→professional, client→consultation
  // and professional→client — without churning existing rows.
  for (const [col, type] of [
    ['kind', "VARCHAR(20) NOT NULL DEFAULT 'professional'"],
    ['bookingId', 'VARCHAR(64) NULL'],
    ['reviewedUserId', 'VARCHAR(64) NULL'],
  ]) {
    try {
      await sequelize.query(
        `ALTER TABLE \`reviews\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(`[Migrate] Could not add reviews.${col}: ${err.message}`);
      }
    }
  }

  // 7g. BookingNote `attachments` JSON column. The booking detail view lets
  // either side attach files alongside a note; legacy rows get the column
  // with NULL so JSON parsing falls back to an empty array.
  try {
    await sequelize.query(
      'ALTER TABLE `booking_notes` ADD COLUMN IF NOT EXISTS `attachments` LONGTEXT NULL'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(
        `[Migrate] Could not add booking_notes.attachments: ${err.message}`
      );
    }
  }

  // 7f. Lead `firmId` + `message` columns. The firm-profile "Contact firm"
  // modal needs both — message for the inquiry text, firmId so each firm
  // sees only the leads addressed to them.
  for (const [col, type] of [
    ['firmId', 'VARCHAR(64) NULL'],
    ['message', 'TEXT NULL'],
  ]) {
    try {
      await sequelize.query(
        `ALTER TABLE \`leads\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(
          `[Migrate] Could not add leads.${col}: ${err.message}`
        );
      }
    }
  }

  // 7b. Allow ownerless firms — admin can create a law firm before assigning
  //     an owner. Earlier the column was NOT NULL.
  try {
    await sequelize.query(
      'ALTER TABLE law_firms MODIFY COLUMN ownerUserId VARCHAR(64) NULL'
    );
  } catch (err) {
    console.warn(
      `[Migrate] Could not relax law_firms.ownerUserId NOT NULL: ${err.message}`
    );
  }

  // 8. Role consolidation: the system now has only `client`, `professional`,
  //    `firm`, `platform_admin`. Collapse legacy values:
  //      firm_admin        -> firm
  //      firm_professional -> professional   (firm membership is tracked
  //                                            via firm_members instead)
  try {
    const [r1] = await sequelize.query(
      "UPDATE users SET role = 'firm' WHERE role = 'firm_admin'"
    );
    const [r2] = await sequelize.query(
      "UPDATE users SET role = 'professional' WHERE role = 'firm_professional'"
    );
    // Firms cannot sign up or log in: every existing firm-role user becomes a
    // professional (firm ownership is tracked via LawFirm.ownerUserId, not
    // via User.role).
    await sequelize.query(
      "UPDATE users SET role = 'professional' WHERE role = 'firm'"
    );
    console.log(
      `[Migrate] Role consolidation complete (firm_admin -> firm: ${
        (r1 && r1.affectedRows) || 0
      }, firm_professional -> professional: ${(r2 && r2.affectedRows) || 0}).`
    );
  } catch (err) {
    console.warn(`[Migrate] Role consolidation failed: ${err.message}`);
  }

  // 9. Unify the data source: every legacy professional gets a real user
  //    record (so /api/admin/users and /api/professionals draw from the
  //    same table), and every legacy firm gets a law_firms row. Idempotent.
  try {
    await sequelize.query(
      'ALTER TABLE law_firms ADD COLUMN IF NOT EXISTS legacyFirmId VARCHAR(64)'
    );
  } catch (err) {
    console.warn(
      `[Migrate] Could not add law_firms.legacyFirmId: ${err.message}`
    );
  }

  try {
    const {
      User,
      Professional,
      ProfessionalDetail,
      ProfessionalApproval,
      Firm,
      LawFirm,
    } = require('../models');

    // --- Professionals backfill --------------------------------------------
    const legacyPros = await Professional.findAll({ raw: true });
    let proCreated = 0;
    let detailCreated = 0;
    let approvalCreated = 0;
    const sharedHash = await hashPassword('password123');
    for (const lp of legacyPros) {
      let linkedUser = await User.findOne({ where: { linkedId: lp.id } });
      if (!linkedUser) {
        const email = `pf-${lp.id}@profirmo.local`;
        const dup = await User.findOne({ where: { email } });
        if (dup) {
          linkedUser = dup;
        } else {
          linkedUser = await User.create({
            email,
            password: sharedHash,
            role: 'professional',
            name: lp.name || '',
            fullName: lp.name || '',
            linkedId: lp.id,
            status: 'active',
            accountVerified: true,
            emailVerified: true,
            memberSince: lp.createdAt || new Date(),
          });
          proCreated += 1;
        }
      }
      let detail = await ProfessionalDetail.findOne({
        where: { userId: linkedUser.id },
      });
      if (!detail) {
        const languages = Array.isArray(lp.languages)
          ? lp.languages
          : (() => {
              try {
                return JSON.parse(lp.languages || '[]');
              } catch {
                return [];
              }
            })();
        await ProfessionalDetail.create({
          userId: linkedUser.id,
          professionalType: lp.professionType || '',
          designation: lp.specialization || '',
          bio: lp.bio || '',
          yearsOfExperience: Number(lp.experience) || 0,
          consultationFee: Number(lp.perMinuteRate) || 0,
          languages,
        });
        detailCreated += 1;
      }
      const approval = await ProfessionalApproval.findOne({
        where: { userId: linkedUser.id },
      });
      if (!approval) {
        await ProfessionalApproval.create({
          userId: linkedUser.id,
          status: 'APPROVED',
        });
        approvalCreated += 1;
      } else if (approval.status !== 'APPROVED') {
        await approval.update({ status: 'APPROVED' });
      }
    }
    console.log(
      `[Migrate] Professional backfill: users +${proCreated}, details +${detailCreated}, approvals +${approvalCreated}.`
    );

    // 9b. Every `professional` user should have an approval row so the admin
    //     panel can show its status. Firm OWNERS (users who own a LawFirm)
    //     are auto-approved — they reached the role via a different path and
    //     should not be blocked from logging in. Anyone else with no
    //     ProfessionalDetail gets a PENDING_APPROVAL row.
    const profUsersWithoutApproval = await User.findAll({
      where: { role: 'professional' },
      attributes: ['id'],
      raw: true,
    });
    let approvalGapFilled = 0;
    let approvalAutoApproved = 0;
    for (const u of profUsersWithoutApproval) {
      const existing = await ProfessionalApproval.findOne({
        where: { userId: u.id },
      });
      const ownsFirm = await LawFirm.findOne({
        where: { ownerUserId: u.id },
      });
      const targetStatus = ownsFirm ? 'APPROVED' : 'PENDING_APPROVAL';
      if (existing) {
        // Firm owners we mistakenly marked PENDING earlier get auto-approved.
        if (ownsFirm && existing.status === 'PENDING_APPROVAL') {
          await existing.update({ status: 'APPROVED' });
          approvalAutoApproved += 1;
        }
        continue;
      }
      await ProfessionalApproval.create({
        userId: u.id,
        status: targetStatus,
      });
      if (targetStatus === 'APPROVED') approvalAutoApproved += 1;
      else approvalGapFilled += 1;
    }
    if (approvalGapFilled > 0 || approvalAutoApproved > 0) {
      console.log(
        `[Migrate] Approval gap filled: +${approvalGapFilled} PENDING, +${approvalAutoApproved} auto-approved firm owners.`
      );
    }

    // --- Firms backfill (dedup-aware) -------------------------------------
    // A user with linkedId='firm-N' who already owns a LawFirm IS the
    // representative for that legacy firm — attach legacyFirmId to it
    // (and drop any earlier backfill duplicate). Otherwise create a row.
    const { Op } = require('sequelize');
    const legacyFirms = await Firm.findAll({ raw: true });
    let firmCreated = 0;
    let firmRelinked = 0;
    let firmDuplicatesRemoved = 0;
    for (const lf of legacyFirms) {
      // Is there a user owning a LawFirm whose linkedId matches this legacy firm?
      const ownerUser = await User.findOne({ where: { linkedId: lf.id } });
      if (ownerUser) {
        const ownedFirm = await LawFirm.findOne({
          where: { ownerUserId: ownerUser.id },
        });
        if (ownedFirm) {
          if (ownedFirm.legacyFirmId !== lf.id) {
            await ownedFirm.update({ legacyFirmId: lf.id });
            firmRelinked += 1;
          }
          // Remove duplicate backfill rows.
          const removed = await LawFirm.destroy({
            where: {
              legacyFirmId: lf.id,
              id: { [Op.ne]: ownedFirm.id },
            },
          });
          firmDuplicatesRemoved += removed;
          continue;
        }
      }

      // Otherwise create or skip.
      const existing = await LawFirm.findOne({
        where: { legacyFirmId: lf.id },
      });
      if (existing) continue;
      const practiceAreas = Array.isArray(lf.services)
        ? lf.services
        : (() => {
            try {
              return JSON.parse(lf.services || '[]');
            } catch {
              return [];
            }
          })();
      await LawFirm.create({
        legacyFirmId: lf.id,
        firmName: lf.name || '',
        headquarters: lf.city || '',
        contactEmail: lf.email || null,
        contactNumber: lf.phone || null,
        about: lf.description || '',
        practiceAreas,
        status: 'ACTIVE',
      });
      firmCreated += 1;
    }
    console.log(
      `[Migrate] Firm backfill: law_firms +${firmCreated}, relinked ${firmRelinked}, duplicates removed ${firmDuplicatesRemoved}.`
    );
  } catch (err) {
    console.warn(`[Migrate] Backfill failed: ${err.message}`);
  }

  // 10. Client unification: clients are first-class users (role='client'), not
  //     a separate table. For every row in the legacy `clients` table we
  //     ensure a corresponding `users` row exists, repoint all clientId FKs
  //     on booking / case / consultation / review to the new user id, populate
  //     the new professional_clients link table from existing relationships,
  //     drop the FK constraints that point at `clients`, then drop the table.
  await runClientUnification();

  // 11. Backfill FirmMember(role='owner') for any LawFirm whose owner does not
  //     yet have an explicit member row, so professional-count + collective
  //     reviews include the owner. Idempotent.
  await runOwnerMemberBackfill();

  // 12. Reviews are always against a professional, never a firm. Drop the
  //     unused `firmId` column from the reviews table.
  await runReviewFirmIdDrop();

  // 13. Reviews can target either a legacy `professionals.id` or a new-model
  //     `professional_details.id`, so the legacy FK on reviews.professionalId
  //     → professionals.id is wrong (blocks reviews against new-model pros).
  //     Drop it; the column stays as a plain string.
  await runReviewProfessionalFkDrop();

  // 14. Same class of stale FKs on cases / bookings / consultations: their
  //     `professionalId` and `firmId` columns now hold either legacy or
  //     new-model ids, so the original FKs to `professionals` / `firms`
  //     reject the new-model values. Drop every such FK; the columns stay.
  await runDependentLegacyFkDrop();

  // 15. Backfill empty CaseNote.authorName values from the User row — older
  //     entries were written with an empty name because the JWT carried no
  //     name fields. Idempotent: skips notes that already have a name.
  await runCaseNoteAuthorNameBackfill();

  // 16. App settings: ensure the new `subCategoryIds` + `practiceCities`
  //     JSON columns exist on `professional_details` for older DBs (sync()
  //     handles fresh DBs).
  for (const col of ['subCategoryIds', 'practiceCities']) {
    try {
      await sequelize.query(
        `ALTER TABLE \`professional_details\` ADD COLUMN IF NOT EXISTS \`${col}\` LONGTEXT`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(
          `[Migrate] Could not add professional_details.${col}: ${err.message}`
        );
      }
    }
  }

  // 16a-pre. Add `stateId` to `cities` so existing rows can be relinked
  // to the new Country/State hierarchy. Idempotent.
  try {
    await sequelize.query(
      'ALTER TABLE `cities` ADD COLUMN IF NOT EXISTS `stateId` VARCHAR(64) NULL'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(
        `[Migrate] Could not add cities.stateId: ${err.message}`
      );
    }
  }

  // 16a. Sub-category `featured` flag — drives the homepage curation.
  try {
    await sequelize.query(
      'ALTER TABLE `sub_categories` ADD COLUMN IF NOT EXISTS `featured` TINYINT(1) NOT NULL DEFAULT 0'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(
        `[Migrate] Could not add sub_categories.featured: ${err.message}`
      );
    }
  }

  // 16a-bis. `uploads.userId` is now nullable so the signup wizard can
  // accept profile-photo / document uploads BEFORE the user has finished
  // registering. The Sequelize-managed FK stays in place but allows NULL.
  try {
    await sequelize.query(
      'ALTER TABLE `uploads` MODIFY COLUMN `userId` VARCHAR(64) NULL'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(
        `[Migrate] Could not relax uploads.userId NOT NULL: ${err.message}`
      );
    }
  }

  // 16b. Backfill primaryCategoryId from the sub_categories -> categories
  //      chain so existing rows have a usable primary category. The
  //      ALTER TABLE that creates this column ran in phase 4a (earlier).
  try {
    await sequelize.query(`
      UPDATE professional_details pd
      JOIN (
        SELECT pd.id AS pdId, sc.categoryId AS catId
        FROM professional_details pd
        JOIN sub_categories sc ON JSON_CONTAINS(pd.subCategoryIds, JSON_QUOTE(sc.id))
        WHERE pd.primaryCategoryId IS NULL OR pd.primaryCategoryId = ''
        GROUP BY pd.id
      ) m ON m.pdId = pd.id
      SET pd.primaryCategoryId = m.catId
      WHERE pd.primaryCategoryId IS NULL OR pd.primaryCategoryId = ''
    `);
  } catch (err) {
    console.warn(
      `[Migrate] Could not backfill professional_details.primaryCategoryId: ${err.message}`
    );
  }

  // 17. Seed the admin-managed taxonomy + cities tables on first boot,
  //     then map every existing professional's `professionalType` string to
  //     a sub-category id. Idempotent: skips rows that already exist.
  await runAppSettingsSeed();

  // 18. Seed Country/State hierarchy + map existing cities to states +
  //     migrate practiceCities city-names to city-ids. Idempotent.
  await runLocationsSeed();

  // 18-bis. Ensure every Indian state / UT has its 2-letter eCourts
  //     code on file (AN, DL, MH, …) and create rows for any code
  //     that's missing entirely (e.g. Telangana, Ladakh, the SC
  //     "Supreme Court" venue code). Idempotent.
  await runStateCodesSeed();

  // 18-ter. Seed comprehensive city lists (district HQs + major
  //     cities) for every Indian state / UT. Idempotent — keyed on
  //     (stateId, lowercased name) so re-runs don't duplicate. New
  //     rows get state-prefixed slugs (mh-aurangabad, br-aurangabad)
  //     so same-named cities across states don't collide on the
  //     global slug-unique constraint.
  await runStateCitiesSeed();

  // 18-quater. Populate the "Legal" professional category with the
  //     admin-supplied taxonomy of 50 main practice areas + their
  //     deeper specialisations. The 50 mains get featured=true so they
  //     surface in the primary professional-search dropdown; deeper
  //     items are featured=false. Idempotent — re-runs only add
  //     genuinely-missing names.
  await runLegalPracticeAreasSeed();

  // 18-quater-b. Populate the "Tax" professional category with the
  //     admin-supplied 3-tier taxonomy from data/taxPracticeAreasSeed.
  //     Wipes any prior Tax sub-categories on first run (or whenever
  //     the row count drifts) and rebuilds from scratch.
  await runTaxPracticeAreasSeed();

  // 18a. Seed the case-status enum (ABATED, DISPOSED, PENDING, …).
  //      Admins can add/edit/delete from /admin/case-statuses. Idempotent.
  await runCaseStatusSeed();

  // 18b. Seed the case-type enum (CC, WP_C, MCrA, …) and the tiny
  //      cause-list-type enum (CIVIL, CRIMINAL, UNKNOWN). Same pattern
  //      as the case-status seed — admins can edit from the
  //      respective /admin/* pages. Both idempotent.
  await runCaseTypeSeed();
  await runCauseListTypeSeed();

  // 19. Razorpay subscription columns. SubscriptionPlan gains the
  //     plan_xxx ids that Razorpay needs to create recurring
  //     subscriptions; ProfessionalSubscription gains the mandate ids we
  //     get back. All additive + nullable so the tables don't need
  //     existing rows to be touched.
  for (const [col, type] of [
    ['razorpayPlanIdMonthly', 'VARCHAR(64) NULL'],
    ['razorpayPlanIdAnnual', 'VARCHAR(64) NULL'],
  ]) {
    try {
      await sequelize.query(
        `ALTER TABLE \`subscription_plans\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(
          `[Migrate] Could not add subscription_plans.${col}: ${err.message}`
        );
      }
    }
  }
  for (const [col, type] of [
    ['razorpaySubscriptionId', 'VARCHAR(64) NULL'],
    ['razorpayCustomerId', 'VARCHAR(64) NULL'],
    ['razorpaySubscriptionStatus', 'VARCHAR(24) NULL'],
    ['razorpayShortUrl', 'VARCHAR(500) NULL'],
  ]) {
    try {
      await sequelize.query(
        `ALTER TABLE \`professional_subscriptions\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(
          `[Migrate] Could not add professional_subscriptions.${col}: ${err.message}`
        );
      }
    }
  }

  // E-Courts India integration: extend the existing `cases` table with the
  // partner-API fields used by the case-detail dashboard. Idempotent — each
  // ADD COLUMN IF NOT EXISTS is safe to re-run on every boot.
  const CASE_ECI_COLUMNS = [
    ['source', "VARCHAR(32) NOT NULL DEFAULT 'manual'"],
    ['cnr', 'VARCHAR(32) NULL'],
    ['caseType', 'VARCHAR(64) NULL'],
    ['courtCode', 'VARCHAR(64) NULL'],
    ['state', 'VARCHAR(64) NULL'],
    ['district', 'VARCHAR(128) NULL'],
    ['filingDate', 'DATE NULL'],
    ['decisionDate', 'DATE NULL'],
    ['petitioners', 'LONGTEXT NULL'],
    ['respondents', 'LONGTEXT NULL'],
    ['judges', 'LONGTEXT NULL'],
    ['petitionerAdvocates', 'LONGTEXT NULL'],
    ['respondentAdvocates', 'LONGTEXT NULL'],
    ['actsAndSections', 'LONGTEXT NULL'],
    ['eciSnapshot', 'LONGTEXT NULL'],
    ['eciSyncedAt', 'DATETIME NULL'],
  ];
  for (const [col, type] of CASE_ECI_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE \`cases\` ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`
      );
    } catch (err) {
      if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
        console.warn(
          `[Migrate] Could not add cases.${col}: ${err.message}`
        );
      }
    }
  }

  // Add parentSubCategoryId to sub_categories so the Legal taxonomy
  // can store a 2-tier hierarchy (tier-1: featured headings; tier-2:
  // the deeper specialisations beneath each). Nullable + additive.
  try {
    await sequelize.query(
      'ALTER TABLE `sub_categories` ADD COLUMN IF NOT EXISTS `parentSubCategoryId` VARCHAR(64) NULL'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(
        `[Migrate] Could not add sub_categories.parentSubCategoryId: ${err.message}`
      );
    }
  }

  // Add the 2-letter `code` column to the existing `states` table.
  // Nullable + additive — legacy rows simply have a NULL code until the
  // states-code backfill (`runStateCodesSeed`) runs.
  try {
    await sequelize.query(
      'ALTER TABLE `states` ADD COLUMN IF NOT EXISTS `code` VARCHAR(8) NULL'
    );
  } catch (err) {
    if (!/doesn'?t exist|Unknown table/i.test(err.message)) {
      console.warn(`[Migrate] Could not add states.code: ${err.message}`);
    }
  }

  console.log('[Migrate] Migrations finished successfully.');
}

// Owners of a LawFirm sometimes lack an explicit FirmMember row (this is true
// of every law_firms row backfilled from a legacy `firms` row). Create one so
// professionalCount + collective-review look-ups treat the owner as a member.
// If the owner lacks a ProfessionalDetail row entirely, create a stub one
// (owners of a firm are by definition professionals).
async function runOwnerMemberBackfill() {
  try {
    const {
      LawFirm,
      FirmMember,
      ProfessionalDetail,
    } = require('../models');
    // Read only the columns we use so the query still works when the model
    // includes columns the DB has not yet picked up via the additive column
    // check that runs below this phase.
    const firms = await LawFirm.findAll({
      attributes: ['id', 'ownerUserId'],
      raw: true,
    });
    let added = 0;
    let detailsCreated = 0;
    for (const f of firms) {
      if (!f.ownerUserId) continue;
      let detail = await ProfessionalDetail.findOne({
        where: { userId: f.ownerUserId },
        raw: true,
      });
      if (!detail) {
        detail = await ProfessionalDetail.create({ userId: f.ownerUserId });
        detailsCreated += 1;
      }
      const existing = await FirmMember.findOne({
        where: { firmId: f.id, professionalId: detail.id },
        raw: true,
      });
      if (existing) continue;
      await FirmMember.create({
        firmId: f.id,
        professionalId: detail.id,
        role: 'owner',
        status: 'active',
        joiningDate: new Date(),
      });
      added += 1;
    }
    if (added > 0 || detailsCreated > 0) {
      console.log(
        `[Migrate] Owner FirmMember backfill: +${added} members, +${detailsCreated} detail stubs.`
      );
    }
  } catch (err) {
    console.warn(`[Migrate] Owner FirmMember backfill failed: ${err.message}`);
  }
}

// `cases / bookings / consultations` keep `professionalId` and `firmId` as
// plain string columns now (they can hold either a legacy id or a new-model
// id). The original Sequelize-generated FKs to the legacy `professionals`
// and `firms` tables reject new-model writes — drop every such FK on these
// three tables. Idempotent (queries INFORMATION_SCHEMA and skips when
// already gone).
async function runDependentLegacyFkDrop() {
  const targets = [
    { table: 'cases', column: 'professionalId', refTable: 'professionals' },
    { table: 'cases', column: 'firmId', refTable: 'firms' },
    { table: 'cases', column: 'clientId', refTable: 'clients' },
    { table: 'bookings', column: 'professionalId', refTable: 'professionals' },
    { table: 'bookings', column: 'clientId', refTable: 'clients' },
    {
      table: 'consultations',
      column: 'professionalId',
      refTable: 'professionals',
    },
    { table: 'consultations', column: 'clientId', refTable: 'clients' },
  ];
  for (const { table, column, refTable } of targets) {
    try {
      const [rows] = await sequelize.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = ?
             AND COLUMN_NAME = ?
             AND REFERENCED_TABLE_NAME = ?`,
        { replacements: [table, column, refTable] }
      );
      for (const fk of rows) {
        try {
          await sequelize.query(
            `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
          );
          console.log(
            `[Migrate] Dropped ${table} FK ${fk.CONSTRAINT_NAME} (${column} → ${refTable}).`
          );
        } catch (err) {
          console.warn(
            `[Migrate] Could not drop ${table} FK ${fk.CONSTRAINT_NAME}: ${err.message}`
          );
        }
      }
    } catch (err) {
      console.warn(
        `[Migrate] Could not inspect ${table}.${column} FKs: ${err.message}`
      );
    }
  }
}

// One-shot backfill: any CaseNote written before the JWT-vs-name fix has
// an empty `authorName` because `displayName(req.user)` returned ''. Look
// each one up by `authorUserId` and copy the resolved name back. Notes
// that already carry a name (or have no `authorUserId`) are left alone.
async function runCaseNoteAuthorNameBackfill() {
  try {
    const { CaseNote, User } = require('../models');
    const { Op } = require('sequelize');
    const empties = await CaseNote.findAll({
      where: {
        authorUserId: { [Op.ne]: null },
        [Op.or]: [{ authorName: '' }, { authorName: null }],
      },
      raw: true,
    });
    if (empties.length === 0) return;

    const userIds = [
      ...new Set(empties.map((n) => n.authorUserId).filter(Boolean)),
    ];
    const users = userIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: userIds } },
          raw: true,
        })
      : [];
    const nameByUserId = new Map(
      users.map((u) => [
        u.id,
        u.fullName ||
          [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
          u.name ||
          '',
      ])
    );
    let patched = 0;
    for (const n of empties) {
      const name = nameByUserId.get(n.authorUserId);
      if (!name) continue;
      await CaseNote.update(
        { authorName: name },
        { where: { id: n.id } }
      );
      patched += 1;
    }
    if (patched > 0) {
      console.log(`[Migrate] CaseNote authorName backfill: +${patched}.`);
    }
  } catch (err) {
    console.warn(`[Migrate] CaseNote authorName backfill failed: ${err.message}`);
  }
}

// Reviews now point at the unified professional id (legacy prof-N OR
// new-model pdetail-...). The legacy FK on reviews.professionalId →
// professionals.id rejects pdetail- writes, so drop it. The column itself
// stays. Idempotent.
async function runReviewProfessionalFkDrop() {
  try {
    const [fks] = await sequelize.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'reviews'
           AND COLUMN_NAME = 'professionalId'
           AND REFERENCED_TABLE_NAME = 'professionals'`
    );
    if (fks.length === 0) return;
    for (const fk of fks) {
      try {
        await sequelize.query(
          `ALTER TABLE \`reviews\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
        );
        console.log(
          `[Migrate] Dropped reviews FK ${fk.CONSTRAINT_NAME} (professionalId → professionals).`
        );
      } catch (err) {
        console.warn(
          `[Migrate] Could not drop reviews FK ${fk.CONSTRAINT_NAME}: ${err.message}`
        );
      }
    }
  } catch (err) {
    console.warn(
      `[Migrate] Could not inspect reviews.professionalId FK: ${err.message}`
    );
  }
}

// Reviews never reference a firm directly — collective reviews are aggregated
// from the member professionals. Drop the unused `firmId` column (and its FK
// + index) from the reviews table.
async function runReviewFirmIdDrop() {
  try {
    const [cols] = await sequelize.query(
      "SHOW COLUMNS FROM `reviews` LIKE 'firmId'"
    );
    if (cols.length === 0) return;
    // 1. Drop any FK constraint on reviews that points at firmId.
    const [fks] = await sequelize.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'reviews'
           AND COLUMN_NAME = 'firmId'
           AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    for (const fk of fks) {
      try {
        await sequelize.query(
          `ALTER TABLE \`reviews\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
        );
      } catch (err) {
        console.warn(
          `[Migrate] Could not drop reviews FK ${fk.CONSTRAINT_NAME}: ${err.message}`
        );
      }
    }
    // 2. Drop any index that references firmId.
    const [indexRows] = await sequelize.query(
      "SHOW INDEX FROM `reviews` WHERE Column_name = 'firmId'"
    );
    const seen = new Set();
    for (const row of indexRows) {
      const name = row.Key_name;
      if (!name || name === 'PRIMARY' || seen.has(name)) continue;
      seen.add(name);
      try {
        await sequelize.query(`ALTER TABLE \`reviews\` DROP INDEX \`${name}\``);
      } catch (err) {
        console.warn(
          `[Migrate] Could not drop reviews index ${name}: ${err.message}`
        );
      }
    }
    // 3. Drop the column.
    await sequelize.query('ALTER TABLE `reviews` DROP COLUMN `firmId`');
    console.log('[Migrate] Dropped reviews.firmId column.');
  } catch (err) {
    console.warn(`[Migrate] Could not drop reviews.firmId: ${err.message}`);
  }
}

// Look up FK constraint names that reference a given parent table, so the
// migration can drop them without knowing the auto-generated name up-front.
async function findFksReferencing(parentTable) {
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME = ?`,
    { replacements: [parentTable] }
  );
  return rows;
}

// Best-effort: the table may not exist on a fresh DB.
async function tableExists(name) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    { replacements: [name] }
  );
  return rows.length > 0;
}

async function runClientUnification() {
  try {
    if (!(await tableExists('clients'))) {
      // Already unified — nothing to do.
      return;
    }
    const {
      User,
      ProfessionalClient,
      Booking,
      Case,
      Consultation,
      Review,
    } = require('../models');

    // Pull every legacy Client row directly via SQL (the model has been
    // removed from the registry; reading via Sequelize would fail).
    const [legacyClients] = await sequelize.query(
      'SELECT id, name, email, phone, city, userType, createdAt FROM clients'
    );

    // clientId -> userId mapping built as we go.
    const map = new Map();
    let userCreated = 0;
    let userMatched = 0;
    for (const c of legacyClients) {
      // 1. User that auth created with linkedId pointing at this client.
      let user = await User.findOne({ where: { linkedId: c.id } });
      // 2. Existing user by email (clients had email; users have email).
      if (!user && c.email) {
        user = await User.findOne({ where: { email: c.email.toLowerCase() } });
      }
      // 3. Existing user by mobile number (clients had phone).
      if (!user && c.phone) {
        user = await User.findOne({ where: { mobileNumber: c.phone } });
      }
      if (user) {
        userMatched += 1;
        // Backfill missing profile fields from the client row.
        const patch = {};
        if (!user.fullName && c.name) patch.fullName = c.name;
        if (!user.name && c.name) patch.name = c.name;
        if (!user.mobileNumber && c.phone) patch.mobileNumber = c.phone;
        if (!user.city && c.city) patch.city = c.city;
        if (user.role !== 'client' && user.role !== 'professional') {
          // Avoid downgrading a professional/admin user.
        }
        if (Object.keys(patch).length > 0) await user.update(patch);
      } else {
        // 4. Create a brand-new user (role=client) for the orphan client row.
        //    Email is required + unique; synthesise one when missing.
        const email = (c.email && c.email.toLowerCase()) ||
          `pf-client-${c.id}@profirmo.local`;
        // Guard against unique-collision on the synthesised email.
        const conflict = await User.findOne({ where: { email } });
        if (conflict) {
          user = conflict;
          userMatched += 1;
        } else {
          user = await User.create({
            email,
            password: await hashPassword('client123'),
            role: 'client',
            name: c.name || '',
            fullName: c.name || '',
            mobileNumber: c.phone || null,
            city: c.city || '',
            linkedId: null,
            status: 'active',
            accountVerified: true,
            emailVerified: true,
            memberSince: c.createdAt || new Date(),
          });
          userCreated += 1;
        }
      }
      map.set(c.id, user.id);
    }
    console.log(
      `[Migrate] Client unification: users matched ${userMatched}, created ${userCreated}.`
    );

    // Drop the linkedId column references that are no longer meaningful —
    // for any user with linkedId pointing at a former clients.id, null it out
    // (the row is now self-contained).
    if (map.size > 0) {
      const legacyIds = Array.from(map.keys());
      await sequelize.query(
        `UPDATE users SET linkedId = NULL
           WHERE role = 'client' AND linkedId IN (${legacyIds.map(() => '?').join(',')})`,
        { replacements: legacyIds }
      );
    }

    // Drop every FK constraint referencing the legacy `clients` table BEFORE
    // we repoint the rows — otherwise the FK refuses to accept user ids.
    const fks = await findFksReferencing('clients');
    for (const fk of fks) {
      try {
        await sequelize.query(
          `ALTER TABLE \`${fk.TABLE_NAME}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
        );
      } catch (err) {
        console.warn(
          `[Migrate] Could not drop FK ${fk.TABLE_NAME}.${fk.CONSTRAINT_NAME}: ${err.message}`
        );
      }
    }

    // Repoint clientId FKs on the four dependent tables.
    let repointed = 0;
    for (const [clientId, userId] of map) {
      const [r1] = await sequelize.query(
        'UPDATE bookings SET clientId = ? WHERE clientId = ?',
        { replacements: [userId, clientId] }
      );
      const [r2] = await sequelize.query(
        'UPDATE cases SET clientId = ? WHERE clientId = ?',
        { replacements: [userId, clientId] }
      );
      const [r3] = await sequelize.query(
        'UPDATE consultations SET clientId = ? WHERE clientId = ?',
        { replacements: [userId, clientId] }
      );
      const [r4] = await sequelize.query(
        'UPDATE reviews SET clientId = ? WHERE clientId = ?',
        { replacements: [userId, clientId] }
      );
      repointed +=
        ((r1 && r1.affectedRows) || 0) +
        ((r2 && r2.affectedRows) || 0) +
        ((r3 && r3.affectedRows) || 0) +
        ((r4 && r4.affectedRows) || 0);
    }
    console.log(
      `[Migrate] Client unification: clientId references repointed = ${repointed}.`
    );

    // Backfill professional_clients from existing case / booking / consultation
    // relationships so each professional sees the clients they have engaged with.
    const linkRows = new Set();
    const addLink = (professionalId, clientUserId) => {
      if (!professionalId || !clientUserId) return;
      linkRows.add(`${professionalId}|${clientUserId}`);
    };
    const cases = await Case.findAll({
      attributes: ['professionalId', 'clientId'],
      raw: true,
    });
    for (const r of cases) addLink(r.professionalId, r.clientId);
    const bookings = await Booking.findAll({
      attributes: ['professionalId', 'clientId'],
      raw: true,
    });
    for (const r of bookings) addLink(r.professionalId, r.clientId);
    const consults = await Consultation.findAll({
      attributes: ['professionalId', 'clientId'],
      raw: true,
    });
    for (const r of consults) addLink(r.professionalId, r.clientId);
    const reviews = await Review.findAll({
      attributes: ['professionalId', 'clientId'],
      raw: true,
    });
    for (const r of reviews) addLink(r.professionalId, r.clientId);

    let linksCreated = 0;
    for (const key of linkRows) {
      const [professionalId, clientUserId] = key.split('|');
      const [existing] = await sequelize.query(
        'SELECT id FROM professional_clients WHERE professionalId = ? AND clientUserId = ? LIMIT 1',
        { replacements: [professionalId, clientUserId] }
      );
      if (existing.length > 0) continue;
      await ProfessionalClient.create({
        professionalId,
        clientUserId,
        addedByUserId: null,
      });
      linksCreated += 1;
    }
    console.log(
      `[Migrate] Client unification: professional_clients +${linksCreated}.`
    );

    // Finally drop the clients table.
    try {
      await sequelize.query('DROP TABLE IF EXISTS clients');
      console.log('[Migrate] Client unification: dropped clients table.');
    } catch (err) {
      console.warn(`[Migrate] Could not drop clients table: ${err.message}`);
    }
  } catch (err) {
    console.warn(`[Migrate] Client unification failed: ${err.message}`);
  }
}

// Seed the App Settings taxonomy on first boot, then backfill every
// existing ProfessionalDetail.subCategoryIds based on the old
// `professionalType` string. Idempotent: existing rows are left alone.
async function runAppSettingsSeed() {
  try {
    const {
      Category,
      SubCategory,
      City,
      ProfessionalDetail,
    } = require('../models');

    const slugify = (s) =>
      String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const SEED_CATEGORIES = [
      {
        slug: 'legal',
        name: 'Legal',
        sortOrder: 1,
        // Sub-categories under Legal are owned by runLegalPracticeAreasSeed
        // (2-tier taxonomy). Keeping this empty so the two seeds don't
        // fight on each boot.
        subs: [],
      },
      {
        slug: 'tax',
        name: 'Tax',
        sortOrder: 2,
        subs: [
          'Tax Consultant',
          'GST Consultant',
          'Income Tax Consultant',
          'Company Registration Consultant',
        ],
      },
    ];

    const SEED_CITIES = [
      'Mumbai',
      'Delhi',
      'Bangalore',
      'Pune',
      'Hyderabad',
      'Chennai',
      'Kolkata',
      'Ahmedabad',
      'Jaipur',
    ];

    // Categories + sub-categories.
    let categoriesCreated = 0;
    let subsCreated = 0;
    for (const c of SEED_CATEGORIES) {
      let cat = await Category.findOne({ where: { slug: c.slug } });
      if (!cat) {
        cat = await Category.create({
          name: c.name,
          slug: c.slug,
          sortOrder: c.sortOrder,
          active: true,
        });
        categoriesCreated += 1;
      }
      let i = 1;
      for (const subName of c.subs) {
        const subSlug = `${c.slug}-${slugify(subName)}`;
        const existing = await SubCategory.findOne({
          where: { slug: subSlug },
        });
        if (!existing) {
          await SubCategory.create({
            categoryId: cat.id,
            name: subName,
            slug: subSlug,
            sortOrder: i,
            active: true,
          });
          subsCreated += 1;
        }
        i += 1;
      }
    }

    // Cities.
    let citiesCreated = 0;
    let i = 1;
    for (const name of SEED_CITIES) {
      const slug = slugify(name);
      const existing = await City.findOne({ where: { slug } });
      if (!existing) {
        await City.create({ name, slug, sortOrder: i, active: true });
        citiesCreated += 1;
      }
      i += 1;
    }

    console.log(
      `[Migrate] App settings seed: categories +${categoriesCreated}, sub-categories +${subsCreated}, cities +${citiesCreated}.`
    );

    // Backfill ProfessionalDetail.subCategoryIds from the legacy
    // `professionalType` string. Map by case-insensitive name match against
    // every active sub-category row. Skip rows that already have a value.
    const allSubs = await SubCategory.findAll({ raw: true });
    const nameToId = new Map();
    for (const s of allSubs) {
      nameToId.set(String(s.name).toLowerCase().trim(), s.id);
    }
    // A few common aliases so older `professionalType` strings still resolve.
    const ALIASES = {
      lawyer: 'advocate',
      ca: 'tax consultant',
      'chartered accountant': 'tax consultant',
      'business consultant': 'company registration consultant',
      'tech consultant': 'company registration consultant',
    };

    const pros = await ProfessionalDetail.findAll({ raw: true });
    let backfilled = 0;
    for (const p of pros) {
      // Parse the existing column (may be raw JSON text, an array, null, or
      // — on fresh DBs that just gained the column — undefined).
      let current = p.subCategoryIds;
      if (typeof current === 'string') {
        try {
          current = JSON.parse(current);
        } catch {
          current = [];
        }
      }
      if (Array.isArray(current) && current.length > 0) continue;

      const rawType = String(p.professionalType || '').toLowerCase().trim();
      if (!rawType) continue;
      const lookup = ALIASES[rawType] || rawType;
      const subId = nameToId.get(lookup);
      if (!subId) continue;
      await ProfessionalDetail.update(
        { subCategoryIds: [subId] },
        { where: { id: p.id } }
      );
      backfilled += 1;
    }
    if (backfilled > 0) {
      console.log(
        `[Migrate] App settings backfill: subCategoryIds set on +${backfilled} professional(s).`
      );
    }
  } catch (err) {
    console.warn(`[Migrate] App settings seed failed: ${err.message}`);
  }
}

// Seed Country / State + relink existing City rows to the right State.
// Idempotent: skips rows whose slug already exists. Once cities have
// stateIds, migrate every professional's `practiceCities` array from
// city NAMES to city IDS so future lookups join on the FK.
async function runLocationsSeed() {
  try {
    const {
      Country,
      State,
      City,
      ProfessionalDetail,
    } = require('../models');

    const slugify = (s) =>
      String(s || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // --- 1. India + states + cities --------------------------------------
    // All 28 Indian states + 8 Union Territories with their major cities.
    // The list is alphabetised so the dropdowns render in a predictable
    // order; admin can reorder via the sortOrder field later.
    const SEED = {
      country: { name: 'India', slug: 'india', code: 'IN', sortOrder: 1 },
      states: [
        // --- States (28) ---
        {
          name: 'Andhra Pradesh',
          cities: [
            'Visakhapatnam',
            'Vijayawada',
            'Guntur',
            'Tirupati',
            'Nellore',
            'Kurnool',
            'Rajahmundry',
          ],
        },
        {
          name: 'Arunachal Pradesh',
          cities: ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang'],
        },
        {
          name: 'Assam',
          cities: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Tezpur'],
        },
        {
          name: 'Bihar',
          cities: [
            'Patna',
            'Gaya',
            'Bhagalpur',
            'Muzaffarpur',
            'Darbhanga',
            'Purnia',
          ],
        },
        {
          name: 'Chhattisgarh',
          cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg'],
        },
        {
          name: 'Goa',
          cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
        },
        {
          name: 'Gujarat',
          cities: [
            'Ahmedabad',
            'Surat',
            'Vadodara',
            'Rajkot',
            'Bhavnagar',
            'Gandhinagar',
            'Jamnagar',
          ],
        },
        {
          name: 'Haryana',
          cities: [
            'Faridabad',
            'Gurugram',
            'Panipat',
            'Ambala',
            'Rohtak',
            'Karnal',
            'Hisar',
          ],
        },
        {
          name: 'Himachal Pradesh',
          cities: ['Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi'],
        },
        {
          name: 'Jharkhand',
          cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh'],
        },
        {
          name: 'Karnataka',
          cities: [
            'Bangalore',
            'Mysore',
            'Mangalore',
            'Hubli',
            'Belgaum',
            'Davangere',
            'Gulbarga',
          ],
        },
        {
          name: 'Kerala',
          cities: [
            'Kochi',
            'Thiruvananthapuram',
            'Kozhikode',
            'Thrissur',
            'Kollam',
            'Kannur',
          ],
        },
        {
          name: 'Madhya Pradesh',
          cities: ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar'],
        },
        {
          name: 'Maharashtra',
          cities: [
            'Mumbai',
            'Pune',
            'Nagpur',
            'Nashik',
            'Aurangabad',
            'Solapur',
            'Thane',
            'Kolhapur',
            'Navi Mumbai',
          ],
        },
        {
          name: 'Manipur',
          cities: ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur'],
        },
        {
          name: 'Meghalaya',
          cities: ['Shillong', 'Tura', 'Jowai', 'Nongstoin'],
        },
        {
          name: 'Mizoram',
          cities: ['Aizawl', 'Lunglei', 'Champhai'],
        },
        {
          name: 'Nagaland',
          cities: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang'],
        },
        {
          name: 'Odisha',
          cities: [
            'Bhubaneswar',
            'Cuttack',
            'Rourkela',
            'Berhampur',
            'Sambalpur',
            'Puri',
          ],
        },
        {
          name: 'Punjab',
          cities: [
            'Ludhiana',
            'Amritsar',
            'Jalandhar',
            'Patiala',
            'Bathinda',
            'Mohali',
            'Pathankot',
          ],
        },
        {
          name: 'Rajasthan',
          cities: [
            'Jaipur',
            'Udaipur',
            'Jodhpur',
            'Kota',
            'Ajmer',
            'Bikaner',
            'Alwar',
          ],
        },
        {
          name: 'Sikkim',
          cities: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan'],
        },
        {
          name: 'Tamil Nadu',
          cities: [
            'Chennai',
            'Coimbatore',
            'Madurai',
            'Tiruchirappalli',
            'Salem',
            'Tirunelveli',
            'Vellore',
            'Erode',
          ],
        },
        {
          name: 'Telangana',
          cities: [
            'Hyderabad',
            'Warangal',
            'Karimnagar',
            'Nizamabad',
            'Khammam',
          ],
        },
        {
          name: 'Tripura',
          cities: ['Agartala', 'Udaipur Tripura', 'Dharmanagar', 'Kailashahar'],
        },
        {
          name: 'Uttar Pradesh',
          cities: [
            'Lucknow',
            'Kanpur',
            'Agra',
            'Varanasi',
            'Noida',
            'Ghaziabad',
            'Meerut',
            'Prayagraj',
            'Bareilly',
            'Gorakhpur',
          ],
        },
        {
          name: 'Uttarakhand',
          cities: [
            'Dehradun',
            'Haridwar',
            'Rishikesh',
            'Nainital',
            'Roorkee',
            'Haldwani',
          ],
        },
        {
          name: 'West Bengal',
          cities: [
            'Kolkata',
            'Howrah',
            'Siliguri',
            'Durgapur',
            'Asansol',
            'Darjeeling',
          ],
        },
        // --- Union Territories (8) ---
        {
          name: 'Andaman and Nicobar Islands',
          cities: ['Port Blair'],
        },
        {
          name: 'Chandigarh',
          cities: ['Chandigarh'],
        },
        {
          name: 'Dadra and Nagar Haveli and Daman and Diu',
          cities: ['Daman', 'Silvassa', 'Diu'],
        },
        { name: 'Delhi', cities: ['Delhi', 'New Delhi'] },
        {
          name: 'Jammu and Kashmir',
          cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
        },
        {
          name: 'Ladakh',
          cities: ['Leh', 'Kargil'],
        },
        {
          name: 'Lakshadweep',
          cities: ['Kavaratti'],
        },
        {
          name: 'Puducherry',
          cities: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
        },
      ],
    };

    // Ensure the country exists.
    let country = await Country.findOne({ where: { slug: SEED.country.slug } });
    if (!country) {
      country = await Country.create({
        name: SEED.country.name,
        slug: SEED.country.slug,
        code: SEED.country.code,
        sortOrder: SEED.country.sortOrder,
        active: true,
      });
      console.log(`[Migrate] Locations: created country ${country.name}.`);
    }

    let statesCreated = 0;
    let citiesCreated = 0;
    let citiesRelinked = 0;
    let stateSort = 1;
    for (const s of SEED.states) {
      const stateSlug = `${country.slug}-${slugify(s.name)}`;
      let state = await State.findOne({ where: { slug: stateSlug } });
      if (!state) {
        state = await State.create({
          countryId: country.id,
          name: s.name,
          slug: stateSlug,
          sortOrder: stateSort,
          active: true,
        });
        statesCreated += 1;
      }
      stateSort += 1;

      let citySort = 1;
      for (const cityName of s.cities) {
        const citySlug = slugify(cityName);
        let city = await City.findOne({ where: { slug: citySlug } });
        if (!city) {
          city = await City.create({
            name: cityName,
            slug: citySlug,
            stateId: state.id,
            sortOrder: citySort,
            active: true,
          });
          citiesCreated += 1;
        } else if (!city.stateId) {
          // Existing pre-hierarchy row — attach to this state.
          await city.update({ stateId: state.id });
          citiesRelinked += 1;
        }
        citySort += 1;
      }
    }
    console.log(
      `[Migrate] Locations seed: states +${statesCreated}, cities +${citiesCreated}, relinked ${citiesRelinked}.`
    );

    // --- 2. Migrate practiceCities (city NAME -> city ID) ----------------
    const allCities = await City.findAll({ raw: true });
    const cityIdByLowerName = new Map(
      allCities.map((c) => [String(c.name || '').toLowerCase().trim(), c.id])
    );
    const cityIdSet = new Set(allCities.map((c) => c.id));
    const pros = await ProfessionalDetail.findAll({ raw: true });
    let proPatched = 0;
    for (const p of pros) {
      let current = p.practiceCities;
      if (typeof current === 'string') {
        try {
          current = JSON.parse(current);
        } catch {
          current = [];
        }
      }
      if (!Array.isArray(current) || current.length === 0) continue;
      // Already-id-form rows are skipped.
      if (current.every((v) => typeof v === 'string' && cityIdSet.has(v))) {
        continue;
      }
      const migrated = [];
      for (const v of current) {
        if (typeof v !== 'string' || !v.trim()) continue;
        if (cityIdSet.has(v)) {
          migrated.push(v); // already an id
          continue;
        }
        const id = cityIdByLowerName.get(v.toLowerCase().trim());
        if (id) migrated.push(id);
      }
      if (
        migrated.length > 0 &&
        JSON.stringify(migrated) !== JSON.stringify(current)
      ) {
        await ProfessionalDetail.update(
          { practiceCities: migrated },
          { where: { id: p.id } }
        );
        proPatched += 1;
      }
    }
    if (proPatched > 0) {
      console.log(
        `[Migrate] Locations backfill: practiceCities migrated to ids on +${proPatched} professional(s).`
      );
    }
  } catch (err) {
    console.warn(`[Migrate] Locations seed failed: ${err.message}`);
  }
}

// runCaseStatusSeed — populate the `case_statuses` lookup on first boot.
// Idempotent: skips rows whose `value` already exists. Admins can edit
// any of these (description, sortOrder, active) or add/delete from
// /admin/case-statuses without touching this seed list.
async function runCaseStatusSeed() {
  const { CaseStatus } = require('../models');
  // Sequence is the default sort order — also matches alphabetical so
  // admins editing the list see entries in a predictable order.
  const SEED = [
    ['ABATED', 'Abated'],
    ['ADJOURNED', 'Adjourned'],
    ['ADMITTED', 'Admitted'],
    ['ALLOWED', 'Allowed'],
    ['ALLOWED_NO_COSTS', 'Allowed (No Costs)'],
    ['APPEARANCE', 'Appearance'],
    ['ARGUMENTS', 'Arguments'],
    ['BAIL_GRANTED', 'Bail Granted'],
    ['BAIL_REJECTED', 'Bail Rejected'],
    ['CHARGE_FRAMED', 'Charge Framed'],
    ['CLOSED', 'Closed'],
    ['COMPLIANCE_PENDING', 'Compliance Pending'],
    ['COMPROMISE', 'Compromise'],
    ['CONTEMPT_PENDING', 'Contempt Pending'],
    ['COUNTER_AFFIDAVIT_FILED', 'Counter Affidavit Filed'],
    ['CROSS_EXAMINATION', 'Cross Examination'],
    ['CURATIVE_PENDING', 'Curative Pending'],
    ['DECREED', 'Decreed'],
    ['DEFECTIVE', 'Defective'],
    ['DEFENCE_EVIDENCE', 'Defence Evidence'],
    ['DISMISSED', 'Dismissed'],
    ['DISMISSED_AS_WITHDRAWN', 'Dismissed as Withdrawn'],
    ['DISMISSED_IN_DEFAULT', 'Dismissed in Default'],
    ['DISMISSED_NO_COSTS', 'Dismissed (No Costs)'],
    ['DISPOSED', 'Disposed'],
    ['EVIDENCE', 'Evidence'],
    ['EXECUTION_PENDING', 'Execution Pending'],
    ['FILED', 'Filed'],
    ['FIRST_HEARING', 'First Hearing'],
    ['FOR_ADMISSION', 'For Admission'],
    ['FOR_JUDGMENT', 'For Judgment'],
    ['FOR_ORDERS', 'For Orders'],
    ['FOR_STEPS', 'For Steps'],
    ['FRAMING_OF_ISSUES', 'Framing of Issues'],
    ['HEARING', 'Hearing'],
    ['INFRUCTUOUS', 'Infructuous'],
    ['INTERIM_ORDER_PASSED', 'Interim Order Passed'],
    ['JUDGMENT', 'Judgment'],
    ['LISTED', 'Listed'],
    ['LOK_ADALAT', 'Lok Adalat'],
    ['LPA_PENDING', 'LPA Pending'],
    ['MAINTENANCE_PENDING', 'Maintenance Pending'],
    ['MEDIATION', 'Mediation'],
    ['MENTIONED', 'Mentioned'],
    ['NOTICE_ISSUED', 'Notice Issued'],
    ['NOT_ADMITTED', 'Not Admitted'],
    ['PARTLY_ALLOWED', 'Partly Allowed'],
    ['PART_HEARD', 'Part Heard'],
    ['PENDING', 'Pending'],
    ['PENDING_AFTER_NOTICE', 'Pending After Notice'],
    ['PENDING_BEFORE_NOTICE', 'Pending Before Notice'],
    ['PIL_PENDING', 'PIL Pending'],
    ['PLAINTIFF_EVIDENCE', 'Plaintiff Evidence'],
    ['PROSECUTION_EVIDENCE', 'Prosecution Evidence'],
    ['READY_FOR_REGISTRATION', 'Ready for Registration'],
    ['REGISTERED', 'Registered'],
    ['REJECTED', 'Rejected'],
    ['REJOINDER_FILED', 'Rejoinder Filed'],
    ['REMANDED', 'Remanded'],
    ['RESERVED', 'Reserved'],
    ['REVIEW_PENDING', 'Review Pending'],
    ['RULE_ABSOLUTE', 'Rule Absolute'],
    ['RULE_DISCHARGED', 'Rule Discharged'],
    ['SERVICE_PENDING', 'Service Pending'],
    ['STAYED', 'Stayed'],
    ['SUMMONS_ISSUED', 'Summons Issued'],
    ['TRANSFERRED', 'Transferred'],
    ['TRIAL', 'Trial'],
    ['UNKNOWN', 'Unknown Status'],
    ['WITHDRAWN', 'Withdrawn'],
    ['WRITTEN_STATEMENT_FILED', 'Written Statement Filed'],
  ];

  try {
    let added = 0;
    for (let i = 0; i < SEED.length; i++) {
      const [value, description] = SEED[i];
      const [, created] = await CaseStatus.findOrCreate({
        where: { value },
        defaults: {
          value,
          description,
          sortOrder: (i + 1) * 10,
          active: true,
        },
      });
      if (created) added += 1;
    }
    console.log(`[Migrate] Case-status seed: +${added} row(s).`);
  } catch (err) {
    console.warn(`[Migrate] Case-status seed failed: ${err.message}`);
  }
}

// runLegalPracticeAreasSeed — populate the "Legal" professional category
// with the admin-supplied taxonomy from `data/legalPracticeAreasSeed.js`.
// The 50 main practice areas (Civil Litigation, Criminal Law, …) become
// featured=true SubCategories that surface in primary dropdowns; each
// deeper item below them becomes a featured=false SubCategory for
// fine-grained tagging on professional profiles. Idempotent: existing
// rows are left untouched, only genuinely-missing names are inserted.
async function runLegalPracticeAreasSeed() {
  const { Category, SubCategory } = require('../models');
  const SEED = require('./legalPracticeAreasSeed');
  const slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  try {
    const legal = await Category.findOne({ where: { slug: 'legal' } });
    if (!legal) {
      console.warn(
        '[Migrate] Legal taxonomy seed skipped: parent category missing.'
      );
      return;
    }

    // Fast-path: if the row count already matches the seed exactly,
    // assume the tree is in good shape and skip the heavy wipe + reinsert.
    // This makes nodemon restarts during development feel snappy instead
    // of paying 30-60s on every code change. To force a re-seed, drop
    // sub_categories under Legal in MySQL and bounce the server.
    let expectedTotal = 0;
    for (const [, tier2Groups] of SEED) {
      expectedTotal += 1;
      for (const [, tier3Items] of tier2Groups) {
        expectedTotal += 1 + (tier3Items || []).length;
      }
    }
    const existingCount = await SubCategory.count({
      where: { categoryId: legal.id },
    });
    if (existingCount === expectedTotal && expectedTotal > 0) {
      console.log(
        `[Migrate] Legal taxonomy seed: already populated (${existingCount} rows) — skipping reseed.`
      );
      return;
    }
    // Curation + drift safety: once any rows exist under Legal we never
    // wipe them automatically. Featured flags and admin edits don't
    // change the row count, so without this guard a partial-state DB
    // would re-trigger the wipe on every boot and erase curation.
    // Admin can drop sub_categories WHERE categoryId='<legal.id>' in
    // MySQL to force a clean reseed.
    if (existingCount > 0) {
      console.log(
        `[Migrate] Legal taxonomy seed: ${existingCount} row(s) already present (expected ${expectedTotal}). Leaving the data alone to preserve admin curation. Drop sub_categories WHERE categoryId='${legal.id}' to force a clean reseed.`
      );
      return;
    }

    // Hard reset: wipe everything under Legal and rebuild from scratch.
    // Runs only when the row count drifts from the expected total
    // (manual deletes, taxonomy file edits, or first-time boot).
    const wiped = await SubCategory.destroy({
      where: { categoryId: legal.id },
    });

    // Slug-uniqueness helper. Slug column has a global unique index, so
    // two rows can't share one even across different categories. Since
    // we've just wiped everything under Legal, the only collisions
    // possible are with other categories' rows — bump a numeric suffix
    // if so.
    const uniqueSlug = async (base) => {
      let cand = base;
      let n = 2;
      while (true) {
        const dup = await SubCategory.findOne({ where: { slug: cand } });
        if (!dup) return cand;
        cand = `${base}-${n}`;
        n += 1;
        if (n > 30) throw new Error(`Could not generate unique slug for ${base}`);
      }
    };

    const stats = { c1: 0, c2: 0, c3: 0 };

    async function createRow({ name, slugBase, parentId, featured, sortOrder }) {
      const slug = await uniqueSlug(slugBase);
      return SubCategory.create({
        categoryId: legal.id,
        parentSubCategoryId: parentId,
        name,
        slug,
        sortOrder,
        featured,
        active: true,
      });
    }

    // --- Walk the 3-tier seed --------------------------------------
    // [tier1Name, [[tier2Name, [tier3Name, …]], …]]
    for (let i = 0; i < SEED.length; i++) {
      const [tier1Name, tier2Groups] = SEED[i];
      const tier1SlugBase = `${legal.slug}-${slugify(tier1Name)}`;
      const t1 = await createRow({
        name: tier1Name,
        slugBase: tier1SlugBase,
        parentId: null,
        // Curated by the admin via /admin/categories — NOT auto-featured.
        // Matches the Tax taxonomy default so both categories start
        // from a clean slate.
        featured: false,
        sortOrder: (i + 1) * 10,
      });
      stats.c1 += 1;

      for (let j = 0; j < tier2Groups.length; j++) {
        const [tier2Name, tier3Items] = tier2Groups[j];
        const tier2SlugBase = `${tier1SlugBase}-${slugify(tier2Name)}`;
        const t2 = await createRow({
          name: tier2Name,
          slugBase: tier2SlugBase,
          parentId: t1.id,
          featured: false,
          sortOrder: (j + 1) * 10,
        });
        stats.c2 += 1;

        for (let k = 0; k < tier3Items.length; k++) {
          const tier3Name = tier3Items[k];
          const tier3SlugBase = `${tier2SlugBase}-${slugify(tier3Name)}`;
          await createRow({
            name: tier3Name,
            slugBase: tier3SlugBase,
            parentId: t2.id,
            featured: false,
            sortOrder: (k + 1) * 10,
          });
          stats.c3 += 1;
        }
      }
    }

    console.log(
      `[Migrate] Legal taxonomy seed: ` +
        `wiped ${wiped}, ` +
        `tier-1 ${stats.c1}, tier-2 ${stats.c2}, tier-3 ${stats.c3}.`
    );
  } catch (err) {
    console.warn(`[Migrate] Legal taxonomy seed failed: ${err.message}`);
  }
}

// runTaxPracticeAreasSeed — same shape as runLegalPracticeAreasSeed
// but for the Tax category. 3-tier taxonomy: tier-1 sub-categories
// (e.g. "Income Tax", "GST"), tier-2 sub-sub-categories
// (e.g. "Income Tax Return Filing"), tier-3 tags (e.g. "Individual
// ITR Filing"). Wipes all prior Tax sub-categories on a fresh run so
// the legacy four flat entries ("Tax Consultant", "GST Consultant",
// "Income Tax Consultant", "Company Registration Consultant") don't
// linger.
async function runTaxPracticeAreasSeed() {
  const { Category, SubCategory } = require('../models');
  const SEED = require('./taxPracticeAreasSeed');
  const slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  try {
    const tax = await Category.findOne({ where: { slug: 'tax' } });
    if (!tax) {
      console.warn(
        '[Migrate] Tax taxonomy seed skipped: parent category missing.'
      );
      return;
    }

    // Fast-path: if the row count already matches the seed exactly,
    // skip the wipe+reinsert. Drop sub_categories under Tax in MySQL
    // to force a reseed.
    let expectedTotal = 0;
    for (const [, tier2Groups] of SEED) {
      expectedTotal += 1;
      for (const [, tier3Items] of tier2Groups) {
        expectedTotal += 1 + (tier3Items || []).length;
      }
    }
    const existingCount = await SubCategory.count({
      where: { categoryId: tax.id },
    });
    if (existingCount === expectedTotal && expectedTotal > 0) {
      console.log(
        `[Migrate] Tax taxonomy seed: already populated (${existingCount} rows) — skipping reseed.`
      );
      return;
    }
    // Curation + drift safety: once any rows exist under Tax we never
    // wipe them automatically. Marking a sub-category featured doesn't
    // change the row count, so without this guard a partial-state DB
    // (e.g. a previous seed run that died midway) would re-trigger
    // the wipe on every boot and erase admin curation. Admin can drop
    // sub_categories WHERE categoryId='<tax.id>' in MySQL to force a
    // clean reseed.
    if (existingCount > 0) {
      console.log(
        `[Migrate] Tax taxonomy seed: ${existingCount} row(s) already present (expected ${expectedTotal}). Leaving the data alone to preserve admin curation. Drop sub_categories WHERE categoryId='${tax.id}' to force a clean reseed.`
      );
      return;
    }

    // Hard reset: wipe everything under Tax (including the four legacy
    // "Tax Consultant", "GST Consultant", "Income Tax Consultant",
    // "Company Registration Consultant" entries) and rebuild from the
    // 3-tier seed.
    const wiped = await SubCategory.destroy({
      where: { categoryId: tax.id },
    });

    // Slug-uniqueness helper — sub_categories.slug is globally unique,
    // so two siblings with the same name across different parents
    // need a numeric suffix to avoid colliding.
    const uniqueSlug = async (base) => {
      let cand = base;
      let n = 2;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const dup = await SubCategory.findOne({ where: { slug: cand } });
        if (!dup) return cand;
        cand = `${base}-${n}`;
        n += 1;
        if (n > 30) {
          throw new Error(`Could not generate unique slug for ${base}`);
        }
      }
    };

    const stats = { c1: 0, c2: 0, c3: 0 };

    async function createRow({ name, slugBase, parentId, featured, sortOrder }) {
      const slug = await uniqueSlug(slugBase);
      return SubCategory.create({
        categoryId: tax.id,
        parentSubCategoryId: parentId,
        name,
        slug,
        sortOrder,
        featured,
        active: true,
      });
    }

    for (let i = 0; i < SEED.length; i++) {
      const [tier1Name, tier2Groups] = SEED[i];
      const tier1SlugBase = `${tax.slug}-${slugify(tier1Name)}`;
      const t1 = await createRow({
        name: tier1Name,
        slugBase: tier1SlugBase,
        parentId: null,
        // Tier-1 starts unfeatured — admin opts each one into the home
        // page directory via /admin/categories.
        featured: false,
        sortOrder: (i + 1) * 10,
      });
      stats.c1 += 1;

      for (let j = 0; j < tier2Groups.length; j++) {
        const [tier2Name, tier3Items] = tier2Groups[j];
        const tier2SlugBase = `${tier1SlugBase}-${slugify(tier2Name)}`;
        const t2 = await createRow({
          name: tier2Name,
          slugBase: tier2SlugBase,
          parentId: t1.id,
          featured: false,
          sortOrder: (j + 1) * 10,
        });
        stats.c2 += 1;

        for (let k = 0; k < (tier3Items || []).length; k++) {
          const tier3Name = tier3Items[k];
          const tier3SlugBase = `${tier2SlugBase}-${slugify(tier3Name)}`;
          await createRow({
            name: tier3Name,
            slugBase: tier3SlugBase,
            parentId: t2.id,
            featured: false,
            sortOrder: (k + 1) * 10,
          });
          stats.c3 += 1;
        }
      }
    }

    console.log(
      `[Migrate] Tax taxonomy seed: ` +
        `wiped ${wiped}, ` +
        `tier-1 ${stats.c1}, tier-2 ${stats.c2}, tier-3 (tags) ${stats.c3}.`
    );
  } catch (err) {
    console.warn(`[Migrate] Tax taxonomy seed failed: ${err.message}`);
  }
}

// runStateCitiesSeed — populate the `cities` table with district HQs +
// major population centres for every Indian state / UT. Seeded list
// covers the cities most likely to be picked from a court-locator or
// address dropdown. Idempotent: (stateId, lowercased-name) is the dedupe
// key, so re-runs only add genuinely-missing rows. New rows get a
// state-prefixed slug (`mh-aurangabad`, `br-aurangabad`) so the same
// name across two states doesn't collide on the global slug-unique
// index. Admins can extend the list from /admin/locations.
async function runStateCitiesSeed() {
  const { State, City } = require('../models');
  const slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // Cities grouped by state code (matches the 2-letter codes seeded by
  // runStateCodesSeed). Each list focuses on district headquarters
  // plus a handful of major non-HQ population centres.
  const CITIES = {
    AN: ['Port Blair', 'Mayabunder', 'Diglipur', 'Rangat', 'Car Nicobar', 'Campbell Bay', 'Hut Bay'],
    AP: [
      'Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore', 'Kurnool',
      'Rajahmundry', 'Kakinada', 'Anantapur', 'Kadapa', 'Chittoor', 'Eluru',
      'Ongole', 'Srikakulam', 'Vizianagaram', 'Machilipatnam', 'Tenali',
      'Proddatur', 'Bhimavaram', 'Nandyal', 'Amaravati',
    ],
    AR: [
      'Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Bomdila', 'Ziro', 'Tezu',
      'Roing', 'Aalo', 'Anini', 'Khonsa', 'Yingkiong', 'Daporijo', 'Changlang',
      'Namsai', 'Seppa', 'Basar', 'Koloriang', 'Yupia',
    ],
    AS: [
      'Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Tezpur', 'Nagaon',
      'Tinsukia', 'Sivasagar', 'Lakhimpur', 'Karimganj', 'Goalpara',
      'Bongaigaon', 'Dhubri', 'Barpeta', 'Diphu', 'Hailakandi', 'Mangaldoi',
      'Haflong', 'Kokrajhar', 'Nalbari', 'North Lakhimpur',
    ],
    BR: [
      'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia',
      'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar', 'Munger', 'Chapra',
      'Bettiah', 'Saharsa', 'Hajipur', 'Sasaram', 'Siwan', 'Motihari',
      'Nawada', 'Buxar', 'Kishanganj', 'Sitamarhi', 'Jamui', 'Khagaria',
      'Madhubani', 'Aurangabad', 'Banka', 'Lakhisarai', 'Sheikhpura',
      'Supaul', 'Jehanabad', 'Madhepura', 'Araria', 'Vaishali',
      'Samastipur', 'Rohtas',
    ],
    CG: [
      'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon',
      'Raigarh', 'Jagdalpur', 'Ambikapur', 'Dhamtari', 'Mahasamund', 'Kanker',
      'Kawardha', 'Bemetara', 'Janjgir', 'Mungeli', 'Surajpur',
      'Manendragarh', 'Balod', 'Baloda Bazar', 'Sukma', 'Dantewada',
      'Bijapur', 'Narayanpur', 'Gariaband', 'Kondagaon',
    ],
    CH: ['Chandigarh', 'Mani Majra'],
    DD: ['Silvassa', 'Daman', 'Diu', 'Naroli', 'Dadra', 'Vapi (DD area)'],
    DL: [
      'New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Karol Bagh', 'Connaught Place',
      'Mehrauli', 'Najafgarh', 'Narela', 'Saket', 'Hauz Khas', 'Pitam Pura',
      'Shahdara', 'Janakpuri', 'Rajouri Garden', 'Lajpat Nagar',
      'Greater Kailash', 'Vasant Kunj', 'Defence Colony', 'Punjabi Bagh',
      'Mayur Vihar', 'Preet Vihar', 'Laxmi Nagar', 'Civil Lines', 'Kalkaji',
      'Patel Nagar',
    ],
    GA: [
      'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim',
      'Curchorem', 'Sanguem', 'Quepem', 'Canacona', 'Pernem', 'Valpoi',
      'Calangute', 'Old Goa', 'Porvorim',
    ],
    GJ: [
      'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Gandhinagar',
      'Jamnagar', 'Junagadh', 'Anand', 'Navsari', 'Mehsana', 'Bharuch', 'Vapi',
      'Nadiad', 'Morbi', 'Surendranagar', 'Gandhidham', 'Veraval', 'Porbandar',
      'Patan', 'Godhra', 'Valsad', 'Ankleshwar', 'Botad', 'Amreli', 'Bhuj',
      'Palanpur', 'Dahod', 'Himatnagar', 'Modasa', 'Kalol', 'Bardoli',
      'Visnagar', 'Diu', 'Halol', 'Vadnagar',
    ],
    HP: [
      'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Palampur', 'Sundarnagar',
      'Una', 'Kullu', 'Hamirpur', 'Bilaspur', 'Chamba', 'Nahan', 'Kangra',
      'Manali', 'Kasauli', 'Dalhousie', 'Reckong Peo', 'Keylong',
      'Paonta Sahib', 'Nalagarh', 'Baddi', 'Parwanoo', 'Rampur',
    ],
    HR: [
      'Faridabad', 'Gurugram', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak',
      'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa',
      'Bahadurgarh', 'Jind', 'Thanesar', 'Kaithal', 'Rewari', 'Palwal',
      'Mahendragarh', 'Charkhi Dadri', 'Fatehabad', 'Narnaul', 'Kurukshetra',
      'Kalka', 'Tohana', 'Hansi', 'Gohana', 'Pehowa',
    ],
    JH: [
      'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar',
      'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar', 'Chaibasa', 'Dumka',
      'Sahibganj', 'Saraikela', 'Khunti', 'Lohardaga', 'Latehar', 'Pakur',
      'Gumla', 'Simdega', 'Garhwa', 'Chatra', 'Koderma', 'Godda', 'Jamtara',
      'Chakradharpur', 'Phusro',
    ],
    JK: [
      'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Sopore', 'Kathua',
      'Udhampur', 'Punch', 'Rajouri', 'Kupwara', 'Pulwama', 'Shopian',
      'Ganderbal', 'Bandipora', 'Doda', 'Ramban', 'Reasi', 'Kishtwar', 'Samba',
      'Akhnoor', 'Kulgam', 'Awantipora', 'Bhaderwah',
    ],
    KA: [
      'Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Kalaburagi',
      'Davangere', 'Bellary', 'Tumakuru', 'Shivamogga', 'Vijayapura', 'Raichur',
      'Bidar', 'Hospet', 'Hassan', 'Gadag', 'Mandya', 'Chitradurga', 'Udupi',
      'Kolar', 'Bagalkot', 'Karwar', 'Chikkamagaluru', 'Chamarajanagar',
      'Bhadravati', 'Ramanagaram', 'Sirsi', 'Yadgir', 'Dharwad', 'Haveri',
      'Madikeri', 'Chikkaballapura', 'Koppal',
    ],
    KL: [
      'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam',
      'Kannur', 'Palakkad', 'Alappuzha', 'Malappuram', 'Pathanamthitta',
      'Kasaragod', 'Idukki', 'Kottayam', 'Wayanad', 'Ernakulam', 'Manjeri',
      'Tirur', 'Ponnani', 'Vatakara', 'Ottapalam', 'Chalakudy',
      'Changanassery', 'Thalassery', 'Thiruvalla', 'Cherthala', 'Aluva',
      'Muvattupuzha', 'Thodupuzha', 'Pala',
    ],
    LD: ['Kavaratti', 'Agatti', 'Andrott', 'Minicoy', 'Amini', 'Kalpeni', 'Kadmat', 'Kiltan'],
    LW: ['Leh', 'Kargil', 'Drass', 'Padum', 'Diskit', 'Nubra', 'Khaltsi'],
    MG: [
      'Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Williamnagar', 'Baghmara',
      'Nongstoin', 'Resubelpara', 'Mawkyrwat', 'Khliehriat', 'Mairang', 'Ampati',
    ],
    MH: [
      'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Pimpri-Chinchwad', 'Nashik',
      'Aurangabad', 'Solapur', 'Amravati', 'Kalyan-Dombivli', 'Vasai-Virar',
      'Navi Mumbai', 'Kolhapur', 'Akola', 'Sangli', 'Jalgaon', 'Malegaon',
      'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur', 'Parbhani', 'Ichalkaranji',
      'Jalna', 'Ambernath', 'Bhiwandi', 'Nanded', 'Wardha', 'Yavatmal', 'Beed',
      'Satara', 'Ratnagiri', 'Osmanabad', 'Hingoli', 'Buldhana', 'Washim',
      'Gondia', 'Bhandara', 'Panvel', 'Alibag', 'Karad', 'Sindhudurg',
      'Sawantwadi', 'Lonavala',
    ],
    MN: [
      'Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Senapati',
      'Tamenglong', 'Ukhrul', 'Chandel', 'Jiribam', 'Kakching', 'Moirang',
      'Moreh', 'Kangpokpi', 'Kamjong', 'Pherzawl', 'Tengnoupal', 'Noney',
    ],
    MP: [
      'Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas',
      'Satna', 'Ratlam', 'Rewa', 'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa',
      'Bhind', 'Chhindwara', 'Guna', 'Shivpuri', 'Vidisha', 'Chhatarpur',
      'Damoh', 'Mandsaur', 'Khargone', 'Neemuch', 'Hoshangabad', 'Sehore',
      'Morena', 'Betul', 'Datia', 'Tikamgarh', 'Sheopur', 'Shahdol', 'Sidhi',
      'Panna', 'Raisen', 'Rajgarh', 'Jhabua', 'Dhar', 'Balaghat', 'Seoni',
      'Mandla', 'Anuppur', 'Umaria', 'Dindori', 'Katni', 'Harda', 'Barwani',
    ],
    MZ: [
      'Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib', 'Saiha',
      'Lawngtlai', 'Mamit', 'Khawzawl', 'Hnahthial', 'Saitual',
    ],
    NL: [
      'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto',
      'Mon', 'Phek', 'Kiphire', 'Longleng', 'Peren', 'Noklak', 'Chumukedima',
    ],
    OD: [
      'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri',
      'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Jeypore', 'Khordha',
      'Bargarh', 'Paradeep', 'Sundargarh', 'Rayagada', 'Phulbani', 'Koraput',
      'Talcher', 'Angul', 'Dhenkanal', 'Kendrapara', 'Boudh', 'Kendujhar',
      'Nuapada', 'Nayagarh', 'Subarnapur', 'Deogarh', 'Gajapati',
      'Jagatsinghpur', 'Jajpur', 'Kalahandi', 'Kandhamal', 'Malkangiri',
      'Mayurbhanj', 'Nabarangpur',
    ],
    PB: [
      'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali',
      'Hoshiarpur', 'Pathankot', 'Moga', 'Abohar', 'Khanna', 'Phagwara',
      'Muktsar', 'Barnala', 'Rajpura', 'Firozpur', 'Kapurthala', 'Sangrur',
      'Fazilka', 'Gurdaspur', 'Tarn Taran', 'Sunam', 'Mansa', 'Malerkotla',
      'Nabha', 'Faridkot', 'Nangal', 'Zirakpur', 'Kharar', 'Rupnagar',
      'Nawanshahr', 'Anandpur Sahib', 'Batala', 'Jagraon',
    ],
    PY: ['Puducherry', 'Karaikal', 'Yanam', 'Mahe', 'Villianur', 'Bahour', 'Ariankuppam'],
    RJ: [
      'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara',
      'Alwar', 'Bharatpur', 'Sikar', 'Pali', 'Sri Ganganagar', 'Tonk',
      'Beawar', 'Hanumangarh', 'Dhaulpur', 'Chittorgarh', 'Banswara',
      'Jhunjhunu', 'Churu', 'Nagaur', 'Sawai Madhopur', 'Karauli', 'Jaisalmer',
      'Dungarpur', 'Rajsamand', 'Pratapgarh', 'Bundi', 'Baran', 'Sirohi',
      'Jhalawar', 'Barmer', 'Jalore', 'Mount Abu', 'Pushkar',
    ],
    SC: ['New Delhi'],
    SK: ['Gangtok', 'Namchi', 'Geyzing', 'Mangan', 'Jorethang', 'Rangpo', 'Singtam', 'Pakyong', 'Soreng', 'Ravangla'],
    TN: [
      'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
      'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur',
      'Ranipet', 'Sivakasi', 'Karur', 'Udhagamandalam', 'Hosur', 'Nagercoil',
      'Kanchipuram', 'Karaikkudi', 'Neyveli', 'Cuddalore', 'Kumbakonam',
      'Tiruvannamalai', 'Pollachi', 'Rajapalayam', 'Pudukkottai',
      'Nagapattinam', 'Sivaganga', 'Krishnagiri', 'Dharmapuri', 'Tindivanam',
      'Virudhunagar', 'Mayiladuthurai', 'Tirupathur', 'Theni', 'Tiruvarur',
      'Namakkal', 'Tenkasi', 'Ariyalur', 'Perambalur',
    ],
    TR: [
      'Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia', 'Ambassa',
      'Khowai', 'Sabroom', 'Sonamura', 'Teliamura', 'Bishalgarh', 'Amarpur',
    ],
    TS: [
      'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam',
      'Ramagundam', 'Mahbubnagar', 'Adilabad', 'Suryapet', 'Siddipet',
      'Miryalaguda', 'Nalgonda', 'Jagityal', 'Mancherial', 'Bhongir',
      'Sangareddy', 'Vikarabad', 'Medak', 'Nirmal', 'Wanaparthy', 'Jangaon',
      'Kothagudem', 'Mahabubabad', 'Asifabad', 'Mulugu', 'Narayanpet',
      'Rajanna Sircilla', 'Peddapalli', 'Kamareddy',
    ],
    UK: [
      'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Kashipur', 'Rudrapur',
      'Rishikesh', 'Pithoragarh', 'Almora', 'Mussoorie', 'Nainital', 'Pauri',
      'Tehri', 'Bageshwar', 'Chamoli', 'Uttarkashi', 'Rudraprayag',
      'Champawat', 'Ramnagar', 'Kotdwar', 'Khatima',
    ],
    UP: [
      'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Meerut', 'Varanasi',
      'Prayagraj', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur',
      'Gorakhpur', 'Faizabad', 'Firozabad', 'Jhansi', 'Muzaffarnagar',
      'Mathura', 'Shahjahanpur', 'Rampur', 'Mau', 'Hapur', 'Etawah',
      'Mirzapur', 'Bulandshahr', 'Sambhal', 'Amroha', 'Hardoi', 'Fatehpur',
      'Raebareli', 'Orai', 'Sitapur', 'Bahraich', 'Unnao', 'Jaunpur',
      'Lakhimpur Kheri', 'Hathras', 'Banda', 'Pilibhit', 'Barabanki',
      'Gonda', 'Mainpuri', 'Lalitpur', 'Etah', 'Deoria', 'Ghazipur',
      'Sultanpur', 'Azamgarh', 'Bijnor', 'Basti', 'Ballia', 'Greater Noida',
      'Noida', 'Shamli', 'Sant Kabir Nagar', 'Kushinagar', 'Maharajganj',
      'Siddharthnagar', 'Balrampur', 'Shravasti', 'Ayodhya', 'Ambedkar Nagar',
      'Pratapgarh', 'Kaushambi', 'Chitrakoot', 'Mahoba', 'Hamirpur',
    ],
    WB: [
      'Kolkata', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman', 'Malda',
      'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Ranaghat', 'Haldia',
      'Raiganj', 'Krishnanagar', 'Nabadwip', 'Medinipur', 'Jalpaiguri',
      'Balurghat', 'Basirhat', 'Bankura', 'Chakdaha', 'Darjeeling',
      'Alipurduar', 'Purulia', 'Jangipur', 'Kurseong', 'Suri', 'Cooch Behar',
      'Bolpur', 'Diamond Harbour', 'Tamluk', 'Contai', 'Howrah', 'Barrackpore',
      'Kanchrapara', 'Barasat', 'Hooghly', 'Kalyani', 'New Town',
      'Dakshin Dinajpur', 'Uttar Dinajpur', 'Jhargram', 'Paschim Bardhaman',
      'Purba Bardhaman',
    ],
  };

  try {
    // Fetch every India-linked state in one query.
    const { Country } = require('../models');
    const country = await Country.findOne({ where: { slug: 'india' } });
    if (!country) {
      console.warn('[Migrate] Cities seed skipped: India country missing.');
      return;
    }
    const states = await State.findAll({
      where: { countryId: country.id },
      raw: true,
    });
    const byCode = new Map();
    for (const s of states) if (s.code) byCode.set(s.code, s);

    // --- Dedupe pass --------------------------------------------------
    // Earlier boots (before the per-(stateId, lowercased-name) guard
    // was solid) created duplicates of the same city within the same
    // state — "AN — Campbell Bay" appears 3x, etc. No FK references
    // cityId in this schema, so it's safe to drop the extras. Keep the
    // row with the smallest id (alphabetically earliest, which for our
    // genId pattern correlates with oldest creation time).
    const stateIds = states.map((s) => s.id);
    if (stateIds.length > 0) {
      const allCities = await City.findAll({
        where: { stateId: stateIds },
        attributes: ['id', 'name', 'stateId'],
        raw: true,
      });
      const buckets = new Map();
      for (const c of allCities) {
        const key = `${c.stateId}|${String(c.name || '').trim().toLowerCase()}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(c);
      }
      const toDelete = [];
      for (const arr of buckets.values()) {
        if (arr.length <= 1) continue;
        // Sort by id ascending so the oldest (alphabetically smallest
        // id) wins; everything after the keeper is redundant.
        arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        for (let i = 1; i < arr.length; i++) toDelete.push(arr[i].id);
      }
      if (toDelete.length > 0) {
        const removed = await City.destroy({ where: { id: toDelete } });
        console.log(
          `[Migrate] Cities dedupe: removed ${removed} duplicate row(s).`
        );
      }
    }

    let totalCreated = 0;
    let totalSkipped = 0;
    for (const [code, list] of Object.entries(CITIES)) {
      const state = byCode.get(code);
      if (!state) {
        console.warn(`[Migrate] Cities seed: no state for code ${code}.`);
        continue;
      }

      // Snapshot existing cities for THIS state, lowercased name as key,
      // so we don't pay a SELECT per row.
      const existing = await City.findAll({
        where: { stateId: state.id },
        attributes: ['id', 'name'],
        raw: true,
      });
      const seen = new Set(
        existing.map((c) => String(c.name || '').trim().toLowerCase())
      );

      let createdForState = 0;
      let sortOrder = 1;
      for (const cityName of list) {
        const key = cityName.trim().toLowerCase();
        if (seen.has(key)) {
          sortOrder += 1;
          totalSkipped += 1;
          continue;
        }
        // State-prefixed slug so same-named cities across states don't
        // collide on the global slug-unique constraint.
        const prefix = (state.code || code).toLowerCase();
        let baseSlug = `${prefix}-${slugify(cityName)}`;
        // Defensive: if a slug already exists (e.g. an admin manually
        // created an oddly-prefixed entry), bump a counter suffix.
        let attempt = baseSlug;
        let n = 2;
        while (await City.findOne({ where: { slug: attempt } })) {
          attempt = `${baseSlug}-${n}`;
          n += 1;
        }
        await City.create({
          name: cityName,
          slug: attempt,
          stateId: state.id,
          sortOrder,
          active: true,
        });
        seen.add(key);
        createdForState += 1;
        totalCreated += 1;
        sortOrder += 1;
      }
      if (createdForState > 0) {
        console.log(
          `[Migrate] Cities seed: ${state.code} ${state.name} +${createdForState}.`
        );
      }
    }
    console.log(
      `[Migrate] Cities seed total: +${totalCreated} created, ${totalSkipped} already present.`
    );
  } catch (err) {
    console.warn(`[Migrate] Cities seed failed: ${err.message}`);
  }
}

// runStateCodesSeed — ensure every Indian state / UT has its 2-letter
// eCourts code recorded, and create rows for any entry that's missing
// entirely. The pair list is the authoritative seed supplied by the
// admin; existing rows are patched (code only — names + slugs are left
// alone so user-customised values aren't clobbered). Idempotent.
async function runStateCodesSeed() {
  const { Country, State, City } = require('../models');
  const slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // Lenient name key — collapses common spelling differences so
  // "Andaman & Nicobar Islands", "Andaman and Nicobar Islands" and
  // "The Andaman and Nicobar Islands" all map to the same bucket.
  const nameKey = (s) =>
    String(s || '')
      .toLowerCase()
      .trim()
      .replace(/^the\s+/, '')
      .replace(/\s+and\s+/g, ' & ')
      .replace(/\s+/g, ' ')
      .trim();

  // (code, name) pairs. The "SC India (Supreme Court)" entry is the
  // eCourts venue code — not a real state, but kept here so it shows
  // up in the same state/UT dropdown the partner API uses.
  const SEED = [
    ['AN', 'Andaman & Nicobar Islands'],
    ['AP', 'Andhra Pradesh'],
    ['AR', 'Arunachal Pradesh'],
    ['AS', 'Assam'],
    ['BR', 'Bihar'],
    ['CG', 'Chhattisgarh'],
    ['CH', 'Chandigarh'],
    ['DD', 'The Dadra And Nagar Haveli And Daman And Diu'],
    ['DL', 'Delhi'],
    ['GA', 'Goa'],
    ['GJ', 'Gujarat'],
    ['HP', 'Himachal Pradesh'],
    ['HR', 'Haryana'],
    ['JH', 'Jharkhand'],
    ['JK', 'Jammu & Kashmir'],
    ['KA', 'Karnataka'],
    ['KL', 'Kerala'],
    ['LD', 'Lakshadweep'],
    ['LW', 'Ladakh'],
    ['MG', 'Meghalaya'],
    ['MH', 'Maharashtra'],
    ['MN', 'Manipur'],
    ['MP', 'Madhya Pradesh'],
    ['MZ', 'Mizoram'],
    ['NL', 'Nagaland'],
    ['OD', 'Odisha'],
    ['PB', 'Punjab'],
    ['PY', 'Puducherry'],
    ['RJ', 'Rajasthan'],
    ['SC', 'India (Supreme Court)'],
    ['SK', 'Sikkim'],
    ['TN', 'Tamil Nadu'],
    ['TR', 'Tripura'],
    ['TS', 'Telangana'],
    ['UK', 'Uttarakhand'],
    ['UP', 'Uttar Pradesh'],
    ['WB', 'West Bengal'],
  ];

  try {
    const country = await Country.findOne({ where: { slug: 'india' } });
    if (!country) {
      console.warn(
        '[Migrate] State-codes seed skipped: India country row missing.'
      );
      return;
    }

    // Pull every state currently linked to India once.
    const existing = await State.findAll({
      where: { countryId: country.id },
    });

    // Pre-pass — merge duplicates introduced by spelling variants
    // ("and" vs "&", "The " prefix). For each nameKey bucket with >1
    // rows we keep the one with the most cities (or the oldest as
    // tiebreaker), transfer the code from any sibling that has one,
    // re-link the sibling's cities, then delete the sibling.
    const buckets = new Map();
    for (const s of existing) {
      const k = nameKey(s.name);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(s);
    }
    let merged = 0;
    for (const [, group] of buckets) {
      if (group.length < 2) continue;
      const counts = await Promise.all(
        group.map((s) => City.count({ where: { stateId: s.id } }))
      );
      let keeperIdx = 0;
      for (let i = 1; i < group.length; i++) {
        if (
          counts[i] > counts[keeperIdx] ||
          (counts[i] === counts[keeperIdx] &&
            new Date(group[i].createdAt) < new Date(group[keeperIdx].createdAt))
        ) {
          keeperIdx = i;
        }
      }
      const keeper = group[keeperIdx];
      let keeperCode = keeper.code;
      for (let i = 0; i < group.length; i++) {
        if (i === keeperIdx) continue;
        const sibling = group[i];
        if (!keeperCode && sibling.code) keeperCode = sibling.code;
        // Re-home any cities pointing at the doomed sibling.
        await City.update(
          { stateId: keeper.id },
          { where: { stateId: sibling.id } }
        );
        await sibling.destroy();
        merged += 1;
      }
      if (keeperCode && keeperCode !== keeper.code) {
        await keeper.update({ code: keeperCode });
      }
    }

    // Refresh the working set + index by nameKey so the seed loop
    // never re-creates a row that the merge pass just consolidated.
    const stateRows = await State.findAll({
      where: { countryId: country.id },
    });
    const byKey = new Map();
    for (const s of stateRows) byKey.set(nameKey(s.name), s);

    let created = 0;
    let patched = 0;
    let sortOrder = 1;
    for (const [code, name] of SEED) {
      const k = nameKey(name);
      const row = byKey.get(k);
      if (row) {
        if (!row.code || row.code !== code) {
          await row.update({ code });
          patched += 1;
        }
      } else {
        const stateSlug = `${country.slug}-${slugify(name)}`;
        const fresh = await State.create({
          countryId: country.id,
          name,
          slug: stateSlug,
          code,
          sortOrder,
          active: true,
        });
        byKey.set(k, fresh);
        created += 1;
      }
      sortOrder += 1;
    }
    console.log(
      `[Migrate] State-codes seed: ${merged} duplicate(s) merged, ${created} created, ${patched} code(s) backfilled.`
    );
  } catch (err) {
    console.warn(`[Migrate] State-codes seed failed: ${err.message}`);
  }
}

// runCaseTypeSeed — populate `case_types` lookup on first boot. Values
// are case-sensitive because the partner taxonomy mixes uppercase codes
// (CONMT) with mixed-case ones (Arb, MCrA, Tax_Ref).
async function runCaseTypeSeed() {
  const { CaseType } = require('../models');
  const SEED = [
    ['ABA', 'Anticipatory Bail Application'],
    ['ADM', 'Admission Matter'],
    ['AFT_APPEAL', 'Appeal from Armed Forces Tribunal'],
    ['ARB_A', 'Arbitration Appeal'],
    ['ARB_PET', 'Arbitration Petition'],
    ['AS', 'Appeal from Subordinate Court'],
    ['Arb', 'Arbitration Case (DC)'],
    ['Arb_Pet', 'Arbitration Petition'],
    ['BA', 'Bail Application'],
    ['CA', 'Civil Appeal'],
    ['CAPP_AT', 'Company Appeal (AT)'],
    ['CAPP_AT_INS', 'Company Appeal (AT) (Insolvency)'],
    ['CAPP_CA', 'Company Appeal (Companies Act)'],
    ['CAPP_IBC', 'Company Appeal (IBC)'],
    ['CAV', 'Caveat'],
    ['CA_CA', 'Company Application (Companies Act)'],
    ['CA_IBC', 'Company Application (IBC)'],
    ['CA_MA_CA', 'Company Application - Merger & Amalgamation (Companies Act)'],
    ['CC', 'Criminal Complaint Case'],
    ['CMA', 'Civil Miscellaneous Appeal'],
    ['CMAppl', 'Civil Miscellaneous Application'],
    ['COMP_APP', 'Compensation Application'],
    ['COMP_APPEAL', 'Competition Appeal (AT)'],
    ['COM_S', 'Commercial Suit'],
    ['CONMT', 'Contempt Petition'],
    ['CONT_AT', 'Contempt Case (AT)'],
    ['CONT_CA', 'Contempt Petition (Companies Act)'],
    ['CONT_IBC', 'Contempt Petition (IBC)'],
    ['COP', 'Company Petition'],
    ['CP_CA', 'Company Petition (Companies Act)'],
    ['CP_IBC', 'Company Petition (IBC)'],
    ['CP_MA_CA', 'Company Petition - Merger & Amalgamation (Companies Act)'],
    ['CR', 'Civil Revision (short form)'],
    ['CRA', 'Criminal Appeal (DC)'],
    ['CRLP', 'Criminal Leave Petition'],
    ['CRLRC', 'Criminal Revision Case'],
    ['CRL_A', 'Criminal Appeal'],
    ['CRL_MA', 'Criminal Miscellaneous Application (DC)'],
    ['CROSS_APPEAL_CA', 'Cross Appeal (Companies Act)'],
    ['CROSS_APPEAL_IBC', 'Cross Appeal (IBC)'],
    ['CROSS_CA', 'Cross Application (Companies Act)'],
    ['CROSS_IBC', 'Cross Application (IBC)'],
    ['CRP', 'Civil Revision Petition'],
    ['CRR', 'Criminal Revision (DC)'],
    ['CR_MISC', 'Criminal Miscellaneous'],
    ['CR_REV', 'Criminal Revision'],
    ['CR_WJC', 'Criminal Writ Jurisdiction Case'],
    ['CS', 'Civil Suit'],
    ['CURP', 'Curative Petition'],
    ['CWJC', 'Civil Writ Jurisdiction Case'],
    ['C_REV', 'Civil Revision'],
    ['DREF', 'Death Reference'],
    ['DV', 'Domestic Violence Case'],
    ['EA', 'Execution Application (Civil)'],
    ['EP', 'Election Petition'],
    ['FA', 'First Appeal'],
    ['FEMA', 'FEMA Case'],
    ['GP', 'Guardianship Petition'],
    ['G_APP', 'General Appeal'],
    ['HCP', 'Habeas Corpus Petition'],
    ['IA', 'Interlocutory Application'],
    ['IA_CA', 'Interlocutory Application (Companies Act)'],
    ['IA_IBC', 'Interlocutory Application (IBC)'],
    ['IA_IBC_DIS', 'Interlocutory Application - Disposal (IBC)'],
    ['IA_IBC_LIQ', 'Interlocutory Application - Liquidation (IBC)'],
    ['IA_IBC_PLAN', 'Interlocutory Application - Plan (IBC)'],
    ['IA_LIQ_PR', 'IA Liquidation Progress Report'],
    ['IB_PREPACK', 'Insolvency & Bankruptcy Pre-Packaged'],
    ['INT_CA', 'Intervention Petition (Companies Act)'],
    ['INT_IBC', 'Intervention Petition (IBC)'],
    ['IP', 'Insolvency Petition'],
    ['ITA', 'Income Tax Appeal'],
    ['LC', 'Land Acquisition Case'],
    ['LPA', 'Letters Patent Appeal'],
    ['MA', 'Miscellaneous Application (Civil)'],
    ['MACA', 'Motor Accident Claims Appeal'],
    ['MA_CA', 'Miscellaneous Application (Companies Act)'],
    ['MA_IBC', 'Miscellaneous Application (IBC)'],
    ['MCOC', 'Maintenance Case'],
    ['MCrA', 'Miscellaneous Criminal Application'],
    ['MFA', 'Miscellaneous First Appeal'],
    ['MJC', 'Miscellaneous Judicial Case (Civil)'],
    ['NDPS', 'NDPS Act Case'],
    ['NGT_APPEAL', 'Appeal from National Green Tribunal'],
    ['OMP', 'Original Miscellaneous Petition'],
    ['OS', 'Original Suit'],
    ['PIL', 'Public Interest Litigation (HC)'],
    ['PP', 'Probate Petition'],
    ['RA_CA', 'Restoration Application (Companies Act)'],
    ['RA_IBC', 'Restoration Application (IBC)'],
    ['RC', 'Rent Control Case'],
    ['RCP_CA', 'Restored Company Petition (Companies Act)'],
    ['RCP_IBC', 'Restored Company Petition (IBC)'],
    ['RCS_A', 'Regular Civil Suit - Class A'],
    ['RCS_B', 'Regular Civil Suit - Class B'],
    ['RCT', 'Regular Criminal Trial'],
    ['REF', 'Reference (Advisory Jurisdiction)'],
    ['REHAB_CA', 'Rehabilitation Petition (Companies Act)'],
    ['REHAB_IBC', 'Rehabilitation Petition (IBC)'],
    ['RERA', 'RERA Appeal'],
    ['REST_APP', 'Restoration Application'],
    ['REV_APP', 'Review Application'],
    ['REV_CA', 'Review Application (Companies Act)'],
    ['REV_IBC', 'Review Application (IBC)'],
    ['RFA', 'Regular First Appeal'],
    ['RP_C', 'Review Petition (Civil)'],
    ['RP_CRL', 'Review Petition (Criminal)'],
    ['RSA', 'Regular Second Appeal'],
    ['RULE63_APPEAL', 'Rule 63 Appeal'],
    ['SA', 'Second Appeal'],
    ['SC', 'Sessions Case'],
    ['SCA', 'Special Civil Application'],
    ['SC_ST', 'SC/ST Act Case'],
    ['SLP_C', 'Special Leave Petition (Civil)'],
    ['SLP_CRL', 'Special Leave Petition (Criminal)'],
    ['ST', 'Sessions Trial'],
    ['SUM', 'Summary Trial'],
    ['Special_Ref', 'Special Reference Case'],
    ['TA_AT', 'Transfer Application (AT)'],
    ['TA_CA', 'Transfer Application (Companies Act)'],
    ['TA_IBC', 'Transfer Application (IBC)'],
    ['TOP_AT', 'Transfer of Proceedings (AT)'],
    ['TP_C', 'Transfer Petition (Civil)'],
    ['TP_CA', 'Transfer Petition (Companies Act)'],
    ['TP_CRL', 'Transfer Petition (Criminal)'],
    ['TP_IBC', 'Transfer Petition (IBC)'],
    ['TS', 'Testamentary Suit'],
    ['Tax_Ref', 'Tax Reference Case'],
    ['UNKNOWN', 'Unrecognized case type'],
    ['VL_IBC', 'Voluntary Liquidation (IBC)'],
    ['WA', 'Writ Appeal'],
    ['WPC_O', 'Writ Petition (Original Jurisdiction)'],
    ['WP_C', 'Writ Petition (Civil)'],
    ['WP_CRL', 'Writ Petition (Criminal)'],
    ['WP_C_PIL', 'Writ Petition (Public Interest Litigation)'],
    ['WP_PIL', 'Writ Petition (Public Interest Litigation - simplified)'],
    ['XOBJ', 'Cross Objection'],
  ];

  try {
    let added = 0;
    for (let i = 0; i < SEED.length; i++) {
      const [value, description] = SEED[i];
      const [, created] = await CaseType.findOrCreate({
        where: { value },
        defaults: {
          value,
          description,
          sortOrder: (i + 1) * 10,
          active: true,
        },
      });
      if (created) added += 1;
    }
    console.log(`[Migrate] Case-type seed: +${added} row(s).`);
  } catch (err) {
    console.warn(`[Migrate] Case-type seed failed: ${err.message}`);
  }
}

// runCauseListTypeSeed — tiny three-entry enum (CIVIL / CRIMINAL /
// UNKNOWN) used to categorise cause-list rows. Idempotent.
async function runCauseListTypeSeed() {
  const { CauseListType } = require('../models');
  const SEED = [
    ['CIVIL', 'Civil'],
    ['CRIMINAL', 'Criminal'],
    ['UNKNOWN', 'Unknown'],
  ];
  try {
    let added = 0;
    for (let i = 0; i < SEED.length; i++) {
      const [value, description] = SEED[i];
      const [, created] = await CauseListType.findOrCreate({
        where: { value },
        defaults: {
          value,
          description,
          sortOrder: (i + 1) * 10,
          active: true,
        },
      });
      if (created) added += 1;
    }
    console.log(`[Migrate] Cause-list-type seed: +${added} row(s).`);
  } catch (err) {
    console.warn(`[Migrate] Cause-list-type seed failed: ${err.message}`);
  }
}

module.exports = { runMigrations };
