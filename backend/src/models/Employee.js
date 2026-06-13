// Sequelize model: Employee
// Field agents who onboard professionals to the platform. Earns
// commission for every admin-APPROVED professional they bring in.
// Phone number doubles as the employee_code (e.g. 9876543210).

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `emp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const Employee = sequelize.define(
  'Employee',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // employee_code = the digit-only form of the phone (e.g. 9876543210).
    // Indexed + unique; used as a public-facing identifier on every
    // professional this employee onboards.
    employeeCode: {
      type: DataTypes.STRING(16),
      allowNull: false,
      unique: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    // Stored exactly as the employee typed it. Allows + and spaces.
    phone: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    // bcrypt hash. Null until the employee sets a password (after OTP).
    passwordHash: { type: DataTypes.STRING(255), allowNull: true },
    // Whether the signup OTP has been verified at least once. Login is
    // blocked until this flips to true.
    otpVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // active | inactive | blocked
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'active',
    },
    // Did the employee tick the T&C checkbox during signup? Captured for
    // audit; signup rejects if false.
    termsAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    termsAcceptedAt: { type: DataTypes.DATE, allowNull: true },
    // Last-login timestamp for the admin listing.
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'employees',
    timestamps: true,
    indexes: [
      { fields: ['employeeCode'], unique: true },
      { fields: ['email'], unique: true },
      { fields: ['phone'], unique: true },
      { fields: ['status'] },
    ],
  }
);

module.exports = Employee;
