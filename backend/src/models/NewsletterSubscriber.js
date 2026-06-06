// Sequelize model: NewsletterSubscriber
//   Footer newsletter sign-ups. The browser POSTs once with an email
//   (creates the row) then a follow-up modal optionally PATCHes the
//   full-name / phone / city / interests.
//
//   id          - generated subscriber id
//   email       - unique, required, lowercased
//   fullName    - optional
//   phone       - optional (E.164 or local)
//   city        - optional free text
//   interests   - optional free text ("legal", "tax", "gst tips", …)
//   source      - 'footer' | 'popup' | 'admin' — where the row originated
//   ipAddress   - client IP at signup
//   userAgent   - client User-Agent at signup
//   status      - 'active' | 'unsubscribed' (default active)
//   + timestamps

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `nsub-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const NewsletterSubscriber = sequelize.define(
  'NewsletterSubscriber',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    fullName: { type: DataTypes.STRING(160), allowNull: true },
    phone: { type: DataTypes.STRING(40), allowNull: true },
    city: { type: DataTypes.STRING(120), allowNull: true },
    interests: { type: DataTypes.STRING(255), allowNull: true },
    source: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'footer',
    },
    ipAddress: { type: DataTypes.STRING(64), allowNull: true },
    userAgent: { type: DataTypes.STRING(500), allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    tableName: 'newsletter_subscribers',
    timestamps: true,
    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['status'] },
      { fields: ['source'] },
    ],
  }
);

module.exports = NewsletterSubscriber;
