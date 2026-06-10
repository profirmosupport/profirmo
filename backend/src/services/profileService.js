// Profile service for the Profirmo backend (Phase 3).
//
// Holds the database logic behind the /api/profile endpoints: loading the
// current user's complete profile (user + address + professional details +
// type-specific details + owned law firm) and upserting personal info,
// address and professional details.

const {
  User,
  Address,
  ProfessionalDetail,
  LawyerDetail,
  TechConsultantDetail,
  LawFirm,
} = require('../models');
const { sanitizeUser } = require('./authService');
const { computeProfileCompletion } = require('../utils/profileCompletion');

// Personal-info columns on the users row that PUT /api/profile may
// update. `email` is special — we accept it but require a uniqueness
// check before saving (see updateProfile). `mobileNumber` is
// intentionally NOT in this list — phone changes must go through
// /api/auth/change-phone which gates on an OTP-verified new number.
const USER_UPDATABLE_FIELDS = [
  'firstName',
  'lastName',
  'profilePhoto',
  'coverPhoto',
];

// Address columns owned by a single user, upserted by userId.
const ADDRESS_FIELDS = [
  'country',
  'state',
  'city',
  'addressLine',
  'postalCode',
];

// Fields whose presence we count when scoring profile completion. Documents
// and identifiers are profession-specific so we check the union and award
// partial credit based on what's filled.
const COMPLETION_FIELDS = [
  // Core
  'yearsOfExperience',
  'consultationFee',
  'bio',
  'skills',
  'languages',
  'education',
  'subCategoryIds',
  'practiceCities',
  'consultancyType',
  'chamberAddress',
  // Profession identifiers (any of the relevant ones count)
  'licenseNumber',
  'barRegistrationNumber',
  'taxRegistrationNumber',
  'enrollmentNumber',
  // Documents (at least the government ID and one profession doc)
  'governmentIdDoc',
  'advocateLicenseDoc',
  'barCouncilCertDoc',
  'lawDegreeDoc',
  'taxRegistrationCertDoc',
  'qualificationCertDoc',
];

function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  return Boolean(value);
}

function computeCompletionPercent(detail) {
  if (!detail) return 0;
  let filled = 0;
  for (const key of COMPLETION_FIELDS) {
    if (isFilled(detail[key])) filled += 1;
  }
  const pct = Math.round((filled / COMPLETION_FIELDS.length) * 100);
  return Math.max(0, Math.min(100, pct));
}

// professional_details columns that PUT /api/profile/professional may set.
const PROFESSIONAL_DETAIL_FIELDS = [
  'professionalType',
  'designation',
  'organization',
  'yearsOfExperience',
  'bio',
  'about',
  'skills',
  'expertise',
  'languages',
  'website',
  'linkedin',
  'certifications',
  'education',
  'achievements',
  'profileResume',
  'licenseDocument',
  'identityDocument',
  'certificationsDocuments',
  // Availability + rate live on the same row so the booking page can read
  // them via GET /api/professionals/:id without a second query.
  'availability',
  'availableNow',
  // Professional's on/off switch for accepting new bookings. When false the
  // marketplace + detail page hide the Book CTA. NULL counts as "on".
  'acceptsOnlineBooking',
  'consultationFee',
  // Admin-managed taxonomy: array of SubCategory.id values. The parent
  // Category is inferred from sub_categories.categoryId.
  'subCategoryIds',
  // Array of city names where the professional practises (separate from
  // their address city). Drives the listing city filter.
  'practiceCities',
  // --- 3-step signup unified fields ----------------------------------
  'primaryCategoryId',
  'consultancyType',
  'courtsPracticing',
  'chamberAddress',
  'licenseNumber',
  'barRegistrationNumber',
  'taxRegistrationNumber',
  'enrollmentNumber',
  'advocateLicenseDoc',
  'barCouncilCertDoc',
  'lawDegreeDoc',
  'taxRegistrationCertDoc',
  'qualificationCertDoc',
  'professionalLicenseDoc',
  'governmentIdDoc',
];

// lawyer_specific_details columns settable via the body's `lawyer` object.
const LAWYER_DETAIL_FIELDS = [
  'barRegistrationNumber',
  'enrollmentNumber',
  'licenseNumber',
  'practiceAreas',
  'courtPractice',
  'jurisdiction',
  'lawDegree',
  'chamberAddress',
  'consultationFee',
  'availability',
  'barCertificate',
  'advocateLicense',
  'practiceCertificate',
];

// tech_consultant_specific_details columns settable via the body's `tech` object.
const TECH_DETAIL_FIELDS = [
  'technologies',
  'specialization',
  'githubProfile',
  'portfolioUrl',
  'certifications',
  'experienceProjects',
  'consultationFee',
];

// Build an object of only the keys present in `source` that are in `allowed`.
const pick = (source = {}, allowed = []) => {
  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = source[key];
    }
  }
  return out;
};

// Convert a Sequelize instance (or null) to a plain object (or null).
const plain = (record) =>
  record && typeof record.get === 'function'
    ? record.get({ plain: true })
    : record || null;

/**
 * Load every profile-related record for a user and assemble the complete
 * profile payload returned by GET / PUT /api/profile.
 *
 * @param {string} userId
 * @returns {Promise<object>} { user, address, professionalDetail,
 *   lawyerDetail, techDetail, lawFirm, profileCompletion }
 */
const getCompleteProfile = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }

  const address = await Address.findOne({ where: { userId } });
  const professionalDetail = await ProfessionalDetail.findOne({
    where: { userId },
  });

  let lawyerDetail = null;
  let techDetail = null;
  if (professionalDetail) {
    lawyerDetail = await LawyerDetail.findOne({
      where: { professionalId: professionalDetail.id },
    });
    techDetail = await TechConsultantDetail.findOne({
      where: { professionalId: professionalDetail.id },
    });
  }

  const lawFirm = await LawFirm.findOne({
    where: { ownerUserId: userId },
  });

  const profileCompletion = computeProfileCompletion({
    role: user.role,
    user: plain(user),
    address: plain(address),
    professionalDetail: plain(professionalDetail),
    lawFirm: plain(lawFirm),
  });

  return {
    user: sanitizeUser(user),
    address: plain(address),
    professionalDetail: plain(professionalDetail),
    lawyerDetail: plain(lawyerDetail),
    techDetail: plain(techDetail),
    lawFirm: plain(lawFirm),
    profileCompletion,
  };
};

// Derive a fullName from first/last names, falling back to the existing name.
const deriveFullName = (firstName, lastName, fallback) => {
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return combined || fallback || null;
};

/**
 * Update the signed-in user's personal info and (upsert) their address, then
 * return the refreshed complete profile.
 *
 * @param {string} userId
 * @param {object} body - may contain personal fields + an `address` object
 * @returns {Promise<object>} complete profile (same shape as getCompleteProfile)
 */
const updateProfile = async (userId, body = {}) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }

  // --- Email change with uniqueness check ----------------------------------
  // Email is updateable but must be unique across users. We don't drop
  // the verified flag automatically — admins can re-verify if needed.
  // The caller (profile UI) prompts the user to re-verify after change.
  if (typeof body.email === 'string') {
    const nextEmail = body.email.trim().toLowerCase();
    if (nextEmail && nextEmail !== String(user.email || '').toLowerCase()) {
      // Basic shape check — same regex the signup form uses.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        throw { statusCode: 422, message: 'Enter a valid email address.' };
      }
      const clash = await User.findOne({ where: { email: nextEmail } });
      if (clash && clash.id !== user.id) {
        throw {
          statusCode: 409,
          message: 'That email is already in use by another account.',
          code: 'EMAIL_ALREADY_REGISTERED',
        };
      }
      user.email = nextEmail;
      user.emailVerified = false;
    }
  }

  // --- Update the users row ------------------------------------------------
  const userUpdates = pick(body, USER_UPDATABLE_FIELDS);
  const dirtyFromUpdates = Object.keys(userUpdates).length > 0;
  if (dirtyFromUpdates) {
    Object.assign(user, userUpdates);
  }
  if (dirtyFromUpdates || user.changed('email')) {
    // Recompute the denormalized fullName / name from first + last name.
    const newFullName = deriveFullName(
      user.firstName,
      user.lastName,
      user.fullName || user.name
    );
    if (newFullName) {
      user.fullName = newFullName;
      user.name = newFullName;
    }
    await user.save();
  }

  // --- Upsert the addresses row by userId ----------------------------------
  if (body.address && typeof body.address === 'object') {
    const addressUpdates = pick(body.address, ADDRESS_FIELDS);
    const existing = await Address.findOne({ where: { userId } });
    if (existing) {
      await existing.update(addressUpdates);
    } else {
      await Address.create({ userId, ...addressUpdates });
    }
  }

  return getCompleteProfile(userId);
};

/**
 * Upsert the caller's professional_details row and, when applicable, the
 * lawyer- or tech-consultant-specific detail row. Returns the refreshed
 * complete profile.
 *
 * @param {string} userId
 * @param {object} body - professional detail fields + optional `lawyer`/`tech`
 * @returns {Promise<object>} complete profile (same shape as getCompleteProfile)
 */
const updateProfessionalProfile = async (userId, body = {}) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }

  // --- Upsert professional_details by userId -------------------------------
  const detailUpdates = pick(body, PROFESSIONAL_DETAIL_FIELDS);
  // `_finalize: true` is sent by the signup wizard's Step 3 submit so the
  // backend can flip `signupComplete` to true. Without it the user is
  // bounced back to /signup on every page load.
  if (body && body._finalize === true) {
    detailUpdates.signupComplete = true;
  }
  let professionalDetail = await ProfessionalDetail.findOne({
    where: { userId },
  });
  if (professionalDetail) {
    await professionalDetail.update(detailUpdates);
  } else {
    professionalDetail = await ProfessionalDetail.create({
      userId,
      ...detailUpdates,
    });
  }
  // Recompute completion percentage after every write so the admin /
  // dashboard widgets reflect the latest state.
  await professionalDetail.update({
    completionPercent: computeCompletionPercent(professionalDetail.get({ plain: true })),
  });

  const professionalType =
    detailUpdates.professionalType || professionalDetail.professionalType;

  // --- Upsert the type-specific detail row ---------------------------------
  // The 3-step signup wizard sends `professionalType: 'Legal Consultant'`
  // (and 'Tax Consultant'). The old type label 'Lawyer' / 'Tech Consultant'
  // is kept as a synonym for legacy callers — match any of them.
  const isLegalType =
    professionalType === 'Lawyer' ||
    /lawyer|advocate|legal/i.test(String(professionalType || ''));
  if (isLegalType && body.lawyer && typeof body.lawyer === 'object') {
    const lawyerUpdates = pick(body.lawyer, LAWYER_DETAIL_FIELDS);
    const existingLawyer = await LawyerDetail.findOne({
      where: { professionalId: professionalDetail.id },
    });
    if (existingLawyer) {
      await existingLawyer.update(lawyerUpdates);
    } else {
      await LawyerDetail.create({
        professionalId: professionalDetail.id,
        ...lawyerUpdates,
      });
    }
  }

  const isTechType =
    professionalType === 'Tech Consultant' ||
    /tech/i.test(String(professionalType || ''));
  if (isTechType && body.tech && typeof body.tech === 'object') {
    const techUpdates = pick(body.tech, TECH_DETAIL_FIELDS);
    const existingTech = await TechConsultantDetail.findOne({
      where: { professionalId: professionalDetail.id },
    });
    if (existingTech) {
      await existingTech.update(techUpdates);
    } else {
      await TechConsultantDetail.create({
        professionalId: professionalDetail.id,
        ...techUpdates,
      });
    }
  }

  return getCompleteProfile(userId);
};

module.exports = {
  getCompleteProfile,
  updateProfile,
  updateProfessionalProfile,
};
