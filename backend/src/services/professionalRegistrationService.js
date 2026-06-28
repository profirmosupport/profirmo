// Professional registration + resubmission service (Phase 7).
//
// Implements the dynamic professional registration flow (Legal Consultant vs
// Tax Consultant) and the resubmission path for rejected / info-requested
// applicants. All multi-row writes run inside a Sequelize transaction.

const crypto = require('crypto');
const {
  sequelize,
  User,
  Session,
  Address,
  ProfessionalDetail,
  LawyerDetail,
  TaxConsultantDetail,
  ProfessionalApproval,
} = require('../models');
const { hashPassword } = require('../utils/password');
const {
  signAccessToken,
  generateRefreshToken,
  hashToken,
} = require('../utils/tokenHelper');
const { enqueue } = require('./queueService');
const notificationService = require('./notificationService');
const { sanitizeUser } = require('./authService');
const env = require('../config/env');

// --- Helpers ---------------------------------------------------------------

// RFC4122 v4 UUID (no external dependency).
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

// The two supported professional types for dynamic registration.
const LEGAL = 'Legal Consultant';
const TAX = 'Tax Consultant';

// Coerce any value to an array (used for the JSON [] columns).
const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
};

// Coerce a value to a boolean.
const toBool = (value) => value === true || value === 'true' || value === 1;

// Treat a value as "present" when it is a non-empty string / non-empty array.
const isMissing = (value) => {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

// --- Validation ------------------------------------------------------------

// Required fields for the Step-1 registration. Professional details
// (yearsOfExperience, bio, identifiers, documents) are filled in later
// via PUT /api/profile/professional so users can complete signup
// incrementally — if they bail out after Step 1 they can log back in and
// finish from /profile/edit.
const COMMON_REQUIRED = [
  'firstName',
  'lastName',
  'email',
  'mobileNumber',
  'password',
  'professionalType',
  'country',
  'state',
  'city',
];

/**
 * Validate a registration payload. Returns a field-errors object — empty
 * when the payload is valid.
 * @param {object} data
 * @returns {object} field -> error message
 */
function validateRegistration(data = {}) {
  const errors = {};

  for (const field of COMMON_REQUIRED) {
    if (isMissing(data[field])) {
      errors[field] = `${field} is required`;
    }
  }

  // yearsOfExperience must be a non-negative number when supplied.
  if (
    !isMissing(data.yearsOfExperience) &&
    Number.isNaN(Number(data.yearsOfExperience))
  ) {
    errors.yearsOfExperience = 'yearsOfExperience must be a number';
  }

  const type = data.professionalType;
  if (type && type !== LEGAL && type !== TAX) {
    errors.professionalType =
      "professionalType must be 'Legal Consultant' or 'Tax Consultant'";
  }

  // Legal- and Tax-specific identifiers are optional at registration time;
  // they are collected in Step 2 of the signup wizard and persisted via
  // PUT /api/profile/professional. The block below is intentionally empty
  // so users can complete signup in stages.
  if (type === LEGAL) {
    // No additional legal validations at signup time.
  } else if (type === TAX) {
    // No additional tax validations at signup time.
  }

  return errors;
}

// --- Field mappers ---------------------------------------------------------

// Build the ProfessionalDetail attributes shared by registration / resubmit.
const buildProfessionalDetailFields = (data = {}) => ({
  professionalType: data.professionalType || null,
  bio: data.bio || null,
  yearsOfExperience: Number(data.yearsOfExperience) || 0,
  skills: toArray(data.skills),
  expertise: toArray(data.expertise),
  languages: toArray(data.languages),
  education: toArray(data.education),
  certifications: toArray(data.certifications),
  website: data.website || null,
  linkedin: data.linkedin || null,
  consultationFee:
    data.consultationFee != null && data.consultationFee !== ''
      ? Number(data.consultationFee)
      : null,
  availability: toArray(data.availability),
  // Document URL mappings (frontend uploads files first, sends URLs).
  identityDocument: data.governmentId || null,
  profileResume: data.resume || null,
  degreeCertificate: data.degreeCertificate || null,
  // --- 3-step signup unified fields ----------------------------------
  primaryCategoryId: data.primaryCategoryId || null,
  subCategoryIds: toArray(data.subCategoryIds),
  practiceCities: toArray(data.practiceCities),
  courtsPracticing: toArray(data.courtsPracticing),
  consultancyType: data.consultancyType || null,
  chamberAddress: data.chamberAddress || null,
  licenseNumber: data.licenseNumber || null,
  barRegistrationNumber: data.barRegistrationNumber || null,
  taxRegistrationNumber: data.taxRegistrationNumber || null,
  enrollmentNumber: data.enrollmentNumber || null,
  advocateLicenseDoc: data.advocateLicenseDoc || null,
  barCouncilCertDoc: data.barCouncilCertDoc || null,
  lawDegreeDoc: data.lawDegreeDoc || null,
  taxRegistrationCertDoc: data.taxRegistrationCertDoc || null,
  qualificationCertDoc: data.qualificationCertDoc || null,
  professionalLicenseDoc: data.professionalLicenseDoc || null,
  governmentIdDoc: data.governmentIdDoc || data.governmentId || null,
  // Employee-onboarding link. Set when /api/employee/onboard-professional
  // is the entry point; null for self-service signups. The commission
  // credit hook on admin-approve reads this pair to decide whether to
  // book an EmployeeCommission row.
  employeeId: data.employeeId || null,
  employeeCode: data.employeeCode || null,
});

// Build the LawyerDetail attributes from the `legal` section.
const buildLawyerFields = (legal = {}) => ({
  barRegistrationNumber: legal.barRegistrationNumber || null,
  enrollmentNumber: legal.enrollmentNumber || null,
  advocateLicenseNumber: legal.advocateLicenseNumber || null,
  practiceAreas: toArray(legal.practiceAreas),
  courtPractice: toArray(legal.courtPractice),
  jurisdiction: legal.jurisdiction || null,
  chamberAddress: legal.chamberAddress || null,
  lawDegree: legal.lawDegree || null,
  consultationType: legal.consultationType || null,
  yearsOfPractice:
    legal.yearsOfPractice != null && legal.yearsOfPractice !== ''
      ? Number(legal.yearsOfPractice)
      : null,
  advocateLicense: legal.advocateLicense || null,
  barCertificate: legal.barCouncilRegistration || null,
  practiceCertificate: legal.practiceCertificate || null,
  lawDegreeDocument: legal.lawDegreeDocument || null,
  supportingCertificates: toArray(legal.supportingCertificates),
});

// Build the TaxConsultantDetail attributes from the `tax` section.
const buildTaxFields = (tax = {}) => ({
  taxRegistrationNumber: tax.taxRegistrationNumber || null,
  specializationAreas: toArray(tax.specializationAreas),
  gstExpertise: toBool(tax.gstExpertise),
  incomeTaxExpertise: toBool(tax.incomeTaxExpertise),
  corporateTaxExpertise: toBool(tax.corporateTaxExpertise),
  businessAdvisory: toBool(tax.businessAdvisory),
  accountingServices: toBool(tax.accountingServices),
  financialPlanning: toBool(tax.financialPlanning),
  consultationType: tax.consultationType || null,
  taxConsultantCertificate: tax.taxConsultantCertificate || null,
  registrationCertificate: tax.registrationCertificate || null,
  professionalLicense: tax.professionalLicense || null,
  supportingCertifications: toArray(tax.supportingCertifications),
});

// --- Admin fan-out ---------------------------------------------------------

/**
 * Notify every platform_admin (in-app + email) that an application needs
 * review. Never throws — notification failures must not break the request.
 * @param {object} opts - { professionalName, professionalType, approvalId, action }
 */
async function notifyAdmins({
  professionalName,
  professionalType,
  approvalId,
  action = 'registered',
}) {
  try {
    const admins = await User.findAll({
      where: { role: 'platform_admin' },
    });
    const reviewUrl = `${env.appUrl}/admin/professionals`;
    const verb = action === 'resubmitted' ? 'resubmitted' : 'registered';
    for (const admin of admins) {
      await notificationService.createNotification({
        userId: admin.id,
        type: 'professional_registration',
        title: 'New professional registration',
        message: `${professionalName} (${professionalType}) has ${verb} and is pending approval.`,
        link: '/admin/professionals',
        metadata: { approvalId, professionalType, action },
      });
      await enqueue('email', {
        to: admin.email,
        template: 'newProfessionalRegistration',
        vars: {
          professionalName,
          professionalType,
          reviewUrl,
        },
      });
    }
  } catch (err) {
    console.error(
      '[ProRegistration] Failed to notify admins:',
      err.message || err
    );
  }
}

// --- Registration ----------------------------------------------------------

/**
 * Register a new professional (Legal Consultant or Tax Consultant).
 * Creates User + Address + ProfessionalDetail + type-specific detail +
 * ProfessionalApproval inside one transaction, then queues the verification
 * email and notifies admins.
 *
 * @param {object} data - the full registration payload
 * @returns {Promise<{ user, emailVerificationRequired, approvalStatus }>}
 */
async function registerProfessional(data = {}) {
  // 1. Validate.
  const errors = validateRegistration(data);
  if (Object.keys(errors).length > 0) {
    throw { statusCode: 422, message: 'Validation failed', errors };
  }

  const email = String(data.email || '').toLowerCase().trim();

  // 2. Reject duplicate email.
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw { statusCode: 409, message: 'Email already registered' };
  }

  // 2a. Resolve optional referral. The signup form accepts a
  // `referralCode` — the employee_code of the field agent who
  // brought this professional. If it matches an ACTIVE Employee row
  // we stamp employeeId + employeeCode on the ProfessionalDetail so
  // admin approval credits the right person. Invalid codes are
  // silently ignored — a typo shouldn't block signup; the employee
  // simply won't be credited.
  const referralCode = String(data.referralCode || '').replace(/\D/g, '');
  if (referralCode) {
    try {
      const { Employee } = require('../models');
      const emp = await Employee.findOne({
        where: { employeeCode: referralCode, status: 'active' },
      });
      if (emp) {
        data.employeeId = emp.id;
        data.employeeCode = emp.employeeCode;
      }
    } catch (err) {
      console.warn(
        '[registerProfessional] referral lookup failed:',
        err.message || err
      );
    }
  }

  const firstName = String(data.firstName || '').trim();
  const lastName = String(data.lastName || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const passwordHash = await hashPassword(data.password);
  const now = new Date();

  // Verification token — raw token is emailed, only the hash is stored.
  const { hashToken } = require('../utils/tokenHelper');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const tokenExpiry = new Date(
    now.getTime() + env.emailVerificationExpiryHours * 3600000
  );

  // 3. Transactional multi-row write.
  const { user, approval } = await sequelize.transaction(
    async (transaction) => {
      const createdUser = await User.create(
        {
          name: fullName,
          email,
          password: passwordHash,
          role: 'professional',
          uuid: genUuid(),
          firstName,
          lastName,
          fullName,
          mobileNumber: data.mobileNumber || null,
          profilePhoto: data.profilePhoto || null,
          status: 'pending_verification',
          isOnline: false,
          accountVerified: false,
          emailVerified: false,
          memberSince: now,
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: tokenExpiry,
          emailVerificationSentAt: now,
        },
        { transaction }
      );

      await Address.create(
        {
          userId: createdUser.id,
          country: data.country || null,
          state: data.state || null,
          city: data.city || null,
          addressLine: data.addressLine || null,
          postalCode: data.postalCode || null,
        },
        { transaction }
      );

      const detail = await ProfessionalDetail.create(
        {
          userId: createdUser.id,
          ...buildProfessionalDetailFields(data),
          verificationStatus: 'pending',
        },
        { transaction }
      );

      if (data.professionalType === LEGAL) {
        await LawyerDetail.create(
          {
            professionalId: detail.id,
            ...buildLawyerFields(data.legal || {}),
          },
          { transaction }
        );
      } else {
        await TaxConsultantDetail.create(
          {
            professionalId: detail.id,
            ...buildTaxFields(data.tax || {}),
          },
          { transaction }
        );
      }

      const createdApproval = await ProfessionalApproval.create(
        {
          userId: createdUser.id,
          professionalDetailId: detail.id,
          professionalType: data.professionalType,
          status: 'PENDING_APPROVAL',
          submittedAt: now,
          resubmissionCount: 0,
        },
        { transaction }
      );

      // Link the user to their professional profile.
      createdUser.linkedId = detail.id;
      await createdUser.save({ transaction });

      return { user: createdUser, approval: createdApproval };
    }
  );

  // 4. Queue the email-verification email (Phase-6 flow).
  await enqueue('email', {
    to: user.email,
    template: 'emailVerification',
    vars: {
      name: user.fullName || user.firstName || 'there',
      verifyUrl: `${env.appUrl}/verify-email?token=${rawToken}`,
      expiryHours: env.emailVerificationExpiryHours,
    },
  });

  // 5. Notify all platform admins (in-app + email).
  await notifyAdmins({
    professionalName: fullName,
    professionalType: data.professionalType,
    approvalId: approval.id,
    action: 'registered',
  });

  // 6. Auto-login after Step 1 so the 3-step wizard can keep saving Step 2
  //    and Step 3 to /api/profile/professional without making the user verify
  //    their email mid-flow. Email verification still happens (the email
  //    above is queued); it just doesn't block the rest of signup.
  const refreshToken = generateRefreshToken();
  await Session.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.refreshTokenDays * 86400000),
  });
  const accessToken = signAccessToken(user);

  return {
    user: sanitizeUser(user, 'PENDING_APPROVAL', { signupComplete: false }),
    emailVerificationRequired: true,
    approvalStatus: 'PENDING_APPROVAL',
    accessToken,
    refreshToken,
  };
}

// --- Resubmission ----------------------------------------------------------

/**
 * Resubmit a rejected / info-requested professional application. Updates the
 * ProfessionalDetail + type-specific details, resets the approval to
 * PENDING_APPROVAL and bumps resubmissionCount — all in one transaction.
 *
 * @param {string} userId - the logged-in professional's user id
 * @param {object} data - { professional?, legal?, tax? } update sections
 * @returns {Promise<{ approvalStatus, resubmissionCount }>}
 */
async function resubmitApplication(userId, data = {}) {
  const approval = await ProfessionalApproval.findOne({ where: { userId } });
  if (!approval) {
    throw { statusCode: 404, message: 'No professional application found' };
  }
  if (
    approval.status !== 'REJECTED' &&
    approval.status !== 'INFO_REQUESTED'
  ) {
    throw {
      statusCode: 400,
      message:
        'Only rejected or info-requested applications can be resubmitted.',
    };
  }

  const detail = await ProfessionalDetail.findByPk(
    approval.professionalDetailId
  );
  if (!detail) {
    throw { statusCode: 404, message: 'Professional profile not found' };
  }

  const user = await User.findByPk(userId);
  const now = new Date();
  // The professional/legal/tax sections may arrive nested or flat.
  const professionalSection = data.professional || data;
  const legalSection = data.legal || {};
  const taxSection = data.tax || {};

  await sequelize.transaction(async (transaction) => {
    // Update the shared professional profile (only with supplied fields).
    const detailUpdates = {};
    const candidate = buildProfessionalDetailFields({
      ...professionalSection,
      // preserve required-but-not-resubmitted core fields.
      professionalType: approval.professionalType,
      yearsOfExperience:
        professionalSection.yearsOfExperience != null
          ? professionalSection.yearsOfExperience
          : detail.yearsOfExperience,
      bio:
        professionalSection.bio != null
          ? professionalSection.bio
          : detail.bio,
    });
    // Apply every mapped field — buildProfessionalDetailFields already
    // normalizes them, and unsupplied arrays default to [].
    Object.assign(detailUpdates, candidate);
    await detail.update(detailUpdates, { transaction });

    if (approval.professionalType === 'Legal Consultant') {
      const lawyer = await LawyerDetail.findOne({
        where: { professionalId: detail.id },
      });
      const lawyerFields = buildLawyerFields(legalSection);
      if (lawyer) {
        await lawyer.update(lawyerFields, { transaction });
      } else {
        await LawyerDetail.create(
          { professionalId: detail.id, ...lawyerFields },
          { transaction }
        );
      }
    } else {
      const taxDetail = await TaxConsultantDetail.findOne({
        where: { professionalId: detail.id },
      });
      const taxFields = buildTaxFields(taxSection);
      if (taxDetail) {
        await taxDetail.update(taxFields, { transaction });
      } else {
        await TaxConsultantDetail.create(
          { professionalId: detail.id, ...taxFields },
          { transaction }
        );
      }
    }

    await detail.update(
      { verificationStatus: 'pending' },
      { transaction }
    );

    await approval.update(
      {
        status: 'PENDING_APPROVAL',
        rejectionReason: null,
        requestedInfo: null,
        resubmissionCount: (approval.resubmissionCount || 0) + 1,
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
      },
      { transaction }
    );
  });

  // Notify admins of the resubmission (in-app + email).
  await notifyAdmins({
    professionalName: user ? user.fullName || user.name : 'A professional',
    professionalType: approval.professionalType,
    approvalId: approval.id,
    action: 'resubmitted',
  });

  return {
    approvalStatus: 'PENDING_APPROVAL',
    resubmissionCount: (approval.resubmissionCount || 0),
  };
}

module.exports = {
  validateRegistration,
  registerProfessional,
  resubmitApplication,
};
