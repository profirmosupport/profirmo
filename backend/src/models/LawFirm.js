// Sequelize model: LawFirm
//   Phase-2 firm entity owned by a user.
//   id, ownerUserId (FK -> users), firmName, registrationNumber, logo,
//   website, establishedYear, about, headquarters, contactEmail,
//   contactNumber, totalEmployees, practiceAreas[], socialLinks{},
//   registrationCertificate, businessLicense, taxDocuments[] + timestamps

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const jsonField = require('./jsonField');

const genId = () =>
  `lawfirm-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const LawFirm = sequelize.define(
  'LawFirm',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // Admin-created firms may be ownerless until an owner is assigned;
    // user-initiated `POST /api/law-firm` always supplies an owner.
    ownerUserId: { type: DataTypes.STRING(64), allowNull: true },
    // When a row originated from the legacy `firms` table during backfill we
    // record the original id here so old `/firms/firm-N` URLs keep resolving.
    legacyFirmId: { type: DataTypes.STRING(64), allowNull: true },
    firmName: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    registrationNumber: { type: DataTypes.STRING, allowNull: true },
    logo: { type: DataTypes.STRING, allowNull: true },
    website: { type: DataTypes.STRING, allowNull: true },
    establishedYear: { type: DataTypes.INTEGER, allowNull: true },
    about: { type: DataTypes.TEXT, allowNull: true },
    headquarters: { type: DataTypes.STRING, allowNull: true },
    contactEmail: { type: DataTypes.STRING, allowNull: true },
    contactNumber: { type: DataTypes.STRING, allowNull: true },
    totalEmployees: { type: DataTypes.INTEGER, allowNull: true },
    // Self-declared number of practising professionals in the firm. Separate
    // from `totalEmployees` (which may include support staff) and from the
    // derived `professionalCount` based on FirmMember rows.
    numberOfProfessionals: { type: DataTypes.INTEGER, allowNull: true },
    practiceAreas: jsonField('practiceAreas', []),
    socialLinks: jsonField('socialLinks', {}),
    registrationCertificate: { type: DataTypes.STRING, allowNull: true },
    businessLicense: { type: DataTypes.STRING, allowNull: true },
    taxDocuments: jsonField('taxDocuments', []),
    // --- Phase-8: firm approval workflow ---------------------------------
    // PENDING_APPROVAL | ACTIVE | REJECTED | MODIFICATIONS_REQUESTED
    status: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'PENDING_APPROVAL',
    },
    // --- Listing additive columns ----------------------------------------
    rating: { type: DataTypes.DECIMAL(3, 2), allowNull: true, defaultValue: 0 },
    reviewsCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    // Admin-curated flag. Featured firms surface on the public home
    // page; toggled from /admin/law-firms.
    featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'law_firms',
    timestamps: true,
    indexes: [{ fields: ['ownerUserId'] }, { fields: ['status'] }],
  }
);

module.exports = LawFirm;
