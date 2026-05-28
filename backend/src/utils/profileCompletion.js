// Profile completion calculator.
//
// Given a user's role plus their loaded profile records, computes an integer
// completion percentage (0-100) by counting filled vs. expected fields that
// are relevant to that role.

// A value counts as "filled" when it is a non-empty string, a non-empty
// array, or a non-null/non-undefined non-string scalar (e.g. a number).
const isFilled = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/** Ratio of filled values out of the supplied list, in [0, 1]. */
const fillRatio = (values) => {
  if (!values.length) return 0;
  const filled = values.filter(isFilled).length;
  return filled / values.length;
};

/** Detect Legal vs Tax from the professionalType label (Legal Consultant /
 *  Tax Consultant) or the legacy `Lawyer` / `Tech Consultant` strings. */
const isLegalType = (label) =>
  /lawyer|advocate|legal/i.test(String(label || ''));

/**
 * Compute a profile completion percentage.
 *
 * Professionals follow the wizard's 10 / 30 / 30 / 30 breakdown:
 *   - 10% profile photo
 *   - 30% Step 1 (personal info + address, excluding photo)
 *   - 30% Step 2 (professional core + identifiers, varies by legal/tax)
 *   - 30% Step 3 (documents, varies by legal/tax)
 * Partial step fills contribute proportionally — half-filled step = 15%.
 *
 * Non-professional roles fall back to a flat "filled / total" sweep over the
 * basic personal + address fields (plus firm fields when applicable).
 *
 * @param {object} args
 * @param {string} args.role
 * @param {object} args.user
 * @param {object|null} args.address
 * @param {object|null} args.professionalDetail
 * @param {object|null} args.lawFirm
 * @returns {number} integer 0-100
 */
const computeProfileCompletion = ({
  role,
  user = {},
  address = null,
  professionalDetail = null,
  lawFirm = null,
} = {}) => {
  if (role === 'professional' || role === 'firm_professional') {
    const pd = professionalDetail || {};
    const addr = address || {};

    // Step 1 — personal info + address. Photo handled separately (10%).
    const step1Fields = [
      user.firstName,
      user.lastName,
      user.mobileNumber,
      addr.country,
      addr.state,
      addr.city,
      addr.addressLine,
    ];

    // Step 2 — professional core (common) + identifiers (type-specific).
    const step2Common = [
      pd.yearsOfExperience,
      pd.consultationFee,
      pd.bio,
      Array.isArray(pd.subCategoryIds)
        ? pd.subCategoryIds.length > 0
        : pd.subCategoryIds,
      Array.isArray(pd.practiceCities)
        ? pd.practiceCities.length > 0
        : pd.practiceCities,
      pd.consultancyType,
    ];
    const legalIdentifiers = [
      pd.barRegistrationNumber,
      pd.enrollmentNumber,
      pd.licenseNumber,
      pd.chamberAddress,
    ];
    const taxIdentifiers = [pd.taxRegistrationNumber];
    const step2Fields = isLegalType(pd.professionalType)
      ? [...step2Common, ...legalIdentifiers]
      : [...step2Common, ...taxIdentifiers];

    // Step 3 — documents. The wizard exposes different document sets for
    // legal vs tax applicants, mirrored here.
    const step3Fields = isLegalType(pd.professionalType)
      ? [
          pd.governmentIdDoc,
          pd.advocateLicenseDoc,
          pd.barCouncilCertDoc,
          pd.lawDegreeDoc,
        ]
      : [
          pd.governmentIdDoc,
          pd.taxRegistrationCertDoc,
          pd.qualificationCertDoc,
          pd.professionalLicenseDoc,
        ];

    const photoPart = isFilled(user.profilePhoto) ? 10 : 0;
    const step1Part = fillRatio(step1Fields) * 30;
    const step2Part = fillRatio(step2Fields) * 30;
    const step3Part = fillRatio(step3Fields) * 30;
    return Math.max(
      0,
      Math.min(100, Math.round(photoPart + step1Part + step2Part + step3Part))
    );
  }

  // --- Non-professional roles -------------------------------------------
  const checks = [];
  checks.push(isFilled(user.firstName));
  checks.push(isFilled(user.lastName));
  checks.push(isFilled(user.mobileNumber));
  checks.push(isFilled(user.profilePhoto));
  checks.push(isFilled(address && address.country));
  checks.push(isFilled(address && address.state));
  checks.push(isFilled(address && address.city));
  checks.push(isFilled(address && address.addressLine));
  checks.push(isFilled(address && address.postalCode));

  if (role === 'firm') {
    const lf = lawFirm || {};
    checks.push(isFilled(lf.firmName));
    checks.push(isFilled(lf.registrationNumber));
    checks.push(isFilled(lf.about));
    checks.push(isFilled(lf.headquarters));
    checks.push(isFilled(lf.contactEmail));
    checks.push(isFilled(lf.practiceAreas));
  }

  const total = checks.length;
  if (total === 0) return 0;
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / total) * 100);
};

module.exports = { computeProfileCompletion, isFilled };
