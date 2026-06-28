// Sequelize model: EmployeePayout
// A request from an employee to withdraw N rupees from their available
// commission balance. Status machine:
//   pending   — submitted, awaiting admin review
//   approved  — admin OK'd it; not yet paid out
//   paid      — admin marked external transfer complete; balance debited
//   rejected  — admin declined; balance untouched
//   on-hold   — admin paused the request
//   cancelled — employee cancelled their own pending request

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `emppayout-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const EmployeePayout = sequelize.define(
  'EmployeePayout',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    employeeId: { type: DataTypes.STRING(64), allowNull: false },
    requestedAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    // Snapshot of the employee's available balance at request time,
    // for the admin queue display.
    availableAtRequest: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'pending',
    },
    adminRemarks: { type: DataTypes.STRING(1000), allowNull: true },
    paymentReference: { type: DataTypes.STRING(128), allowNull: true },
    paidAt: { type: DataTypes.DATE, allowNull: true },
    paidBy: { type: DataTypes.STRING(64), allowNull: true }, // admin user id
  },
  {
    tableName: 'employee_payouts',
    timestamps: true,
    indexes: [
      { fields: ['employeeId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = EmployeePayout;
