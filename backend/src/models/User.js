// Sequelize model: User
//   id, name, email, password, role, linkedId, firmId + profile/session
//   columns + timestamps.
// Roles: 'client' | 'professional' | 'firm_admin' | 'firm_professional' | 'platform_admin'
// NOTE: password now stores a bcrypt hash for new users. Legacy demo rows may
//       still contain plain text; verifyPassword() in utils/password.js
//       handles both transparently.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    name: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'client' },
    linkedId: { type: DataTypes.STRING(64), allowNull: true },
    firmId: { type: DataTypes.STRING(64), allowNull: true },

    // --- Extended profile / account columns (additive migration) ----------
    uuid: { type: DataTypes.STRING, allowNull: true, unique: true },
    firstName: { type: DataTypes.STRING, allowNull: true },
    lastName: { type: DataTypes.STRING, allowNull: true },
    fullName: { type: DataTypes.STRING, allowNull: true },
    mobileNumber: { type: DataTypes.STRING, allowNull: true },
    profilePhoto: { type: DataTypes.STRING, allowNull: true },
    coverPhoto: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true, defaultValue: 'active' },
    isOnline: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    memberSince: { type: DataTypes.DATE, allowNull: true },
    lastLogin: { type: DataTypes.DATE, allowNull: true },
    accountVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    mobileVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },

    // --- Email-verification columns (Phase 6, additive migration) ---------
    // SHA-256 hash of the raw verification token (raw token is emailed only).
    emailVerificationTokenHash: { type: DataTypes.STRING, allowNull: true },
    // When the current verification token expires.
    emailVerificationExpiresAt: { type: DataTypes.DATE, allowNull: true },
    // When the most recent verification email was queued.
    emailVerificationSentAt: { type: DataTypes.DATE, allowNull: true },

    // --- Phase-10: client unification — fields previously on the clients ---
    //     table now live on the user. Both are optional and only meaningful
    //     for users with role='client' (other roles ignore them).
    city: { type: DataTypes.STRING, allowNull: true },
    userType: { type: DataTypes.STRING, allowNull: true, defaultValue: 'individual' },
  },
  {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { fields: ['email'] },
      { fields: ['role'] },
      { fields: ['firmId'] },
    ],
  }
);

module.exports = User;
