// Sequelize model: ProfessionalClient — link table connecting a professional
// (public professional id: legacy `prof-N` OR new `pdetail-...`) with a
// client-user (users.id where role='client'). A single client-user can be
// linked with multiple professionals, and a professional can have many
// linked clients. Cases / bookings / consultations still carry their own
// clientId; this table records the explicit "this client belongs to my book"
// relationship a professional creates from their dashboard.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `pc-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const ProfessionalClient = sequelize.define(
  'ProfessionalClient',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // Public professional id (Professional.id OR ProfessionalDetail.id).
    professionalId: { type: DataTypes.STRING(64), allowNull: false },
    // users.id of the linked client (role='client').
    clientUserId: { type: DataTypes.STRING(64), allowNull: false },
    // users.id of the actor who created the link (typically the professional's
    // own user account, but a firm owner can also add a client).
    addedByUserId: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    tableName: 'professional_clients',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['professionalId', 'clientUserId'] },
      { fields: ['professionalId'] },
      { fields: ['clientUserId'] },
    ],
  }
);

module.exports = ProfessionalClient;
