// Sequelize model: EmailTemplate — admin-editable email body store.
// Each row corresponds to one trigger point in the system (e.g.
// 'emailVerification', 'paymentReceipt'). The renderer falls back to
// the hardcoded TEMPLATES registry in src/emails/templates.js when no
// row exists for a key — so a fresh deployment works with zero rows
// until the admin opts into customisation.
//
// Variable substitution is plain {{var}} mustache-style — see
// services/emailTemplateService.js for the renderer. No conditional
// logic, no loops; if you need richer templating, move to Handlebars.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmailTemplate = sequelize.define(
  'EmailTemplate',
  {
    // Logical template id — matches the key passed to enqueue('email', ...)
    // and TEMPLATES[key] in the hardcoded registry. Examples:
    //   emailVerification, clientInvitation, professionalApproval, …
    key: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
    },
    // Human-readable name shown in the admin list.
    label: { type: DataTypes.STRING(255), allowNull: true },
    // Short description of when this template fires (e.g. "Sent on
    // signup when a new account is created").
    triggerPoint: { type: DataTypes.STRING(255), allowNull: true },
    // Comma-separated variable names available for {{var}} substitution
    // (used by the admin UI to render a helper chips list). Plain text
    // because Sequelize/MySQL JSON CHECK constraints across older
    // installs are unreliable.
    variables: { type: DataTypes.TEXT, allowNull: true },
    // Subject + body templates. Bodies hold the full HTML / text — the
    // shared `layout()` wrapper is baked into the stored HTML by the
    // seed step so admins can edit branding too.
    subject: { type: DataTypes.TEXT, allowNull: true },
    htmlBody: { type: DataTypes.TEXT('long'), allowNull: true },
    textBody: { type: DataTypes.TEXT('long'), allowNull: true },
    // When `false`, the renderer ignores the DB row and falls back to
    // the hardcoded template — useful as a kill switch if an edit goes
    // wrong without forcing the admin to delete the row.
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    updatedByUserId: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    tableName: 'email_templates',
    timestamps: true,
  }
);

module.exports = EmailTemplate;
