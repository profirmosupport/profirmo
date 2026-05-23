// Sequelize model: CaseNote
//   A note appended to a case by a professional / firm member / admin.
//   id, caseId, authorUserId, authorName, body + timestamps

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () =>
  `note-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const CaseNote = sequelize.define(
  'CaseNote',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    caseId: { type: DataTypes.STRING(64), allowNull: false },
    authorUserId: { type: DataTypes.STRING(64), allowNull: true },
    authorName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    body: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  },
  {
    tableName: 'case_notes',
    timestamps: true,
    indexes: [{ fields: ['caseId'] }, { fields: ['authorUserId'] }],
  }
);

module.exports = CaseNote;
