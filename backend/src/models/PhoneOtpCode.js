// Sequelize model: PhoneOtpCode
//   One row per phone-OTP issued. The flow:
//     POST /api/auth/phone/send-otp  -> upsert a row (reuse existing
//                                       active one OR insert a new one)
//     POST /api/auth/phone/verify-otp -> compare code, mark verified
//
//   id           - generated row id (primary key)
//   phone        - E.164 phone number (indexed)
//   purpose      - 'login' | 'signup' | 'change-phone'  (indexed)
//   code         - 6-digit OTP, stored in clear so we can RESEND the same
//                  value when the user asks for another SMS within the
//                  validity window (Ping4SMS API replaces {#var#} with
//                  this value). NOTE: this is a deliberate trade-off
//                  against the email-OTP table which bcrypt-hashes its
//                  codes — phone-OTP must be re-sendable verbatim.
//   expiresAt    - when the OTP stops being valid (default: now + 10 min)
//   verified     - whether this OTP has been successfully verified
//   consumedAt   - when the verified OTP was used to complete a flow.
//                  Once consumed the row is dead — a fresh OTP must be
//                  requested for any further action.
//   attemptCount - number of incorrect verification attempts so far
//   resendCount  - number of times the SAME code has been re-sent
//   lastSentAt   - when the most recent SMS was queued (used for cooldown)
//   + timestamps
//
// Indexes on `phone` + `purpose` so the "do we already have a live OTP
// for this number?" lookup is fast.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `otp-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

const PhoneOtpCode = sequelize.define(
  'PhoneOtpCode',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    phone: { type: DataTypes.STRING(32), allowNull: false },
    purpose: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'login',
    },
    code: { type: DataTypes.STRING(6), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    consumedAt: { type: DataTypes.DATE, allowNull: true },
    attemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    resendCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastSentAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'phone_otp_codes',
    timestamps: true,
    indexes: [{ fields: ['phone'] }, { fields: ['phone', 'purpose'] }],
  }
);

module.exports = PhoneOtpCode;
