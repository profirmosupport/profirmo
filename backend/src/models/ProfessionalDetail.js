// Sequelize model: ProfessionalDetail
//   Extended professional profile linked one-to-one to a user.
//   id, userId (unique FK -> users), professionalType, designation,
//   organization, yearsOfExperience, bio, about, skills[], expertise[],
//   languages[], website, linkedin, certifications[], education[],
//   achievements[], profileResume, licenseDocument, identityDocument,
//   certificationsDocuments[], verificationStatus, verifiedBy,
//   verificationDate + timestamps
// professionalType: 'Lawyer' | 'Tech Consultant' | 'Tax Consultant'
//   | 'Business Consultant' | 'CA' | 'Other'

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const jsonField = require('./jsonField');

const genId = () =>
  `pdetail-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const ProfessionalDetail = sequelize.define(
  'ProfessionalDetail',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    professionalType: { type: DataTypes.STRING, allowNull: true },
    designation: { type: DataTypes.STRING, allowNull: true },
    organization: { type: DataTypes.STRING, allowNull: true },
    yearsOfExperience: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bio: { type: DataTypes.TEXT, allowNull: true },
    about: { type: DataTypes.TEXT, allowNull: true },
    skills: jsonField('skills', []),
    expertise: jsonField('expertise', []),
    languages: jsonField('languages', []),
    // Admin-managed taxonomy: ids referencing rows in `sub_categories`.
    // The parent category is inferred via sub_categories.categoryId.
    subCategoryIds: jsonField('subCategoryIds', []),
    // Array of city names (matching `cities.name`) where the professional
    // actually practises. Separate from the address city — they may live in
    // Mumbai but practise across Mumbai, Pune and Delhi.
    practiceCities: jsonField('practiceCities', []),
    website: { type: DataTypes.STRING, allowNull: true },
    linkedin: { type: DataTypes.STRING, allowNull: true },
    certifications: jsonField('certifications', []),
    education: jsonField('education', []),
    achievements: jsonField('achievements', []),
    profileResume: { type: DataTypes.STRING, allowNull: true },
    licenseDocument: { type: DataTypes.STRING, allowNull: true },
    identityDocument: { type: DataTypes.STRING, allowNull: true },
    certificationsDocuments: jsonField('certificationsDocuments', []),
    verificationStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    verifiedBy: { type: DataTypes.STRING, allowNull: true },
    verificationDate: { type: DataTypes.DATE, allowNull: true },
    // --- Phase-7 additive columns ----------------------------------------
    consultationFee: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    availability: jsonField('availability', []),
    // Live "available now" toggle the booking page uses to enable instant
    // consultations. NULL is treated as "available" so legacy rows remain
    // bookable until the professional explicitly toggles off.
    availableNow: { type: DataTypes.BOOLEAN, allowNull: true },
    // Professional-controlled flag. When false, the public marketplace +
    // detail page hide the "Book consultation" CTA. NULL is treated as
    // "accepting" so existing rows + new signups default to bookable.
    acceptsOnlineBooking: { type: DataTypes.BOOLEAN, allowNull: true },
    degreeCertificate: { type: DataTypes.STRING, allowNull: true },
    // --- Listing additive columns ----------------------------------------
    rating: { type: DataTypes.DECIMAL(3, 2), allowNull: true, defaultValue: 0 },
    reviewsCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    // Admin-curated flag. Featured rows surface on the public home page
    // "Verified Consultants" section. NOT a quality ranking — the panel
    // simply picks which directory entries to spotlight. Defaults to
    // false; toggled from the admin professionals page.
    featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // --- 3-step signup unification --------------------------------------
    // Top-level mirrors of fields previously split between LawyerDetail /
    // TaxConsultantDetail so the new signup wizard and the listing API can
    // read every profession's data from one place.
    primaryCategoryId: { type: DataTypes.STRING(64), allowNull: true },
    consultancyType: { type: DataTypes.STRING(20), allowNull: true },
    courtsPracticing: jsonField('courtsPracticing', []),
    chamberAddress: { type: DataTypes.TEXT, allowNull: true },
    licenseNumber: { type: DataTypes.STRING, allowNull: true },
    barRegistrationNumber: { type: DataTypes.STRING, allowNull: true },
    taxRegistrationNumber: { type: DataTypes.STRING, allowNull: true },
    enrollmentNumber: { type: DataTypes.STRING, allowNull: true },
    // Document URLs — uploaded during step 3, profession-specific.
    advocateLicenseDoc: { type: DataTypes.STRING, allowNull: true },
    barCouncilCertDoc: { type: DataTypes.STRING, allowNull: true },
    lawDegreeDoc: { type: DataTypes.STRING, allowNull: true },
    taxRegistrationCertDoc: { type: DataTypes.STRING, allowNull: true },
    qualificationCertDoc: { type: DataTypes.STRING, allowNull: true },
    professionalLicenseDoc: { type: DataTypes.STRING, allowNull: true },
    governmentIdDoc: { type: DataTypes.STRING, allowNull: true },
    // Computed by the backend on every write; 0–100 ratio of filled
    // mandatory + recommended fields.
    completionPercent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Set to true ONLY after the professional reaches Step 3 of the
    // signup wizard and submits. The frontend uses this flag to bounce
    // incomplete signups back to the wizard so all three steps are
    // actually filled in.
    signupComplete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'professional_details',
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['professionalType'] },
      { fields: ['verificationStatus'] },
    ],
  }
);

module.exports = ProfessionalDetail;
