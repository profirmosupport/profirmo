// Sequelize model: CaseLog
//   Audit trail of actions on a case (create, status change, assignment,
//   note added, file added, …). Each row is one event.
//   id, caseId, actorUserId, actorName, action, message, metadata + timestamps

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `clog-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const CaseLog = sequelize.define(
  'CaseLog',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    caseId: { type: DataTypes.STRING(64), allowNull: false },
    actorUserId: { type: DataTypes.STRING(64), allowNull: true },
    actorName: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    action: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    message: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'case_logs',
    timestamps: true,
    indexes: [{ fields: ['caseId'] }, { fields: ['createdAt'] }],
  }
);

module.exports = CaseLog;
