// Sequelize model: Lead
//   Captured from the homepage "Discuss with AI" CTA and from the gated
//   advanced-search popup. Admin manages leads through /admin/leads, can
//   add notes and activities, change status, assign to a team member and
//   convert a qualified lead into an Opportunity (and ultimately a Client).

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () => `lead-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const Lead = sequelize.define(
  'Lead',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    fullName: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(40), allowNull: false },
    // Free-text inquiry written by the visitor on the firm contact form.
    message: { type: DataTypes.TEXT, allowNull: true },
    // Firm the visitor was contacting (when the lead was submitted via the
    // firm-profile "Contact firm" modal). Nullable for legacy homepage /
    // advanced-search leads which aren't tied to any specific firm.
    firmId: { type: DataTypes.STRING(64), allowNull: true },
    // Where the lead came from. Sources today: "Homepage AI CTA",
    // "Advanced Search", "Firm contact". Free-form string so the admin can
    // add more sources later.
    source: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'Homepage AI CTA',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'New',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    assignedToUserId: { type: DataTypes.STRING(64), allowNull: true },
    // Set when the lead has been converted into an Opportunity / Client.
    opportunityId: { type: DataTypes.STRING(64), allowNull: true },
    clientId: { type: DataTypes.STRING(64), allowNull: true },
    convertedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'leads',
    timestamps: true,
    indexes: [
      { fields: ['email'] },
      { fields: ['phone'] },
      { fields: ['status'] },
      { fields: ['assignedToUserId'] },
      { fields: ['firmId'] },
    ],
  }
);

module.exports = Lead;
