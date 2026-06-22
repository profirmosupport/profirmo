// Sequelize model: Booking
//   id, clientId, professionalId, date, time, duration, type,
//   estimatedCost, status + timestamps
// type: 'instant' | 'scheduled'
// status: 'pending' | 'confirmed' | 'completed' | 'cancelled'

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `booking-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const Booking = sequelize.define(
  'Booking',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    clientId: { type: DataTypes.STRING(64), allowNull: true },
    professionalId: { type: DataTypes.STRING(64), allowNull: true },
    date: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    time: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'scheduled',
    },
    estimatedCost: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    // Anchor for the 5-day review + escrow-release window. Set when the
    // booking is flipped to 'completed' by the professional.
    completedAt: { type: DataTypes.DATE, allowNull: true },
    // Google Calendar event id when this booking has been mirrored to
    // the professional's Google Calendar. NULL means "not yet pushed"
    // — the push happens lazily when Google access is granted and
    // re-runs on subsequent booking updates.
    googleEventId: { type: DataTypes.STRING(128), allowNull: true },
  },
  {
    tableName: 'bookings',
    timestamps: true,
    indexes: [
      { fields: ['clientId'] },
      { fields: ['professionalId'] },
      { fields: ['status'] },
      { fields: ['type'] },
    ],
  }
);

module.exports = Booking;
