// Sequelize model: EmployeeCommission
// One row per approved professional an employee onboarded. Created
// when an admin APPROVES the professional (not before — pending /
// rejected pros don't earn commission). Snapshots the per-onboarding
// amount from the AdminSetting at approval time so a later setting
// change doesn't retroactively reprice old commissions.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `empcom-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const EmployeeCommission = sequelize.define(
  'EmployeeCommission',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    employeeId: { type: DataTypes.STRING(64), allowNull: false },
    // The professional this commission was earned on. Points at
    // ProfessionalDetail.userId for portability (matches how the
    // existing services key off the user-id, not the detail-id).
    professionalUserId: { type: DataTypes.STRING(64), allowNull: false },
    // Amount in INR (whole rupees — admin configures small numbers
    // like ₹10 per approved pro, not paise).
    commissionAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // earned | reversed
    // `earned`   — counted toward the employee's available balance.
    // `reversed` — the professional was later un-approved / blocked
    //              and we clawed the commission back.
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'earned',
    },
    // Free-text admin remark when reversing.
    remark: { type: DataTypes.STRING(500), allowNull: true },
  },
  {
    tableName: 'employee_commissions',
    timestamps: true,
    indexes: [
      { fields: ['employeeId'] },
      { fields: ['professionalUserId'] },
      // One commission row per (employee, professional) pair — flips
      // re-approve into an UPDATE rather than a duplicate row.
      { fields: ['employeeId', 'professionalUserId'], unique: true },
      { fields: ['status'] },
    ],
  }
);

module.exports = EmployeeCommission;
