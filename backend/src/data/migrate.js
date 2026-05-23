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
  ],
  law_firms: [
    ['rating', 'DECIMAL(3,2) DEFAULT 0'],
    ['reviewsCount', 'INT DEFAULT 0'],
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
    const firms = await LawFirm.findAll({ raw: true });
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

module.exports = { runMigrations };
