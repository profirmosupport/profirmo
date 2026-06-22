// CaseTask — sub-tasks owned by a Case. Lets a professional (or anyone
// they delegate to within their firm) split case work into actionable
// items with a status + optional due date. Distinct from
// ProfessionalReminder (personal todos) and CaseUpdate (chronological
// log of what happened) — tasks describe what still needs to happen.
//
// Status lifecycle: open → in_progress → done   (or → cancelled at any point).
// Assignee is a User id; null means "unassigned" (anyone on the case can
// pick it up). Ordering uses `position` so the UI can drag-reorder
// without re-stamping createdAt.

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `ctask-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const STATUSES = ['open', 'in_progress', 'done', 'cancelled'];
const PRIORITIES = ['low', 'normal', 'high'];

const CaseTask = sequelize.define(
  'CaseTask',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    caseId: { type: DataTypes.STRING(64), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    assigneeUserId: { type: DataTypes.STRING(64), allowNull: true },
    dueDate: { type: DataTypes.DATEONLY, allowNull: true },
    status: {
      type: DataTypes.ENUM(...STATUSES),
      allowNull: false,
      defaultValue: 'open',
    },
    priority: {
      type: DataTypes.ENUM(...PRIORITIES),
      allowNull: false,
      defaultValue: 'normal',
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdByUserId: { type: DataTypes.STRING(64), allowNull: false },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    completedByUserId: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    tableName: 'case_tasks',
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['caseId'] },
      { fields: ['caseId', 'status'] },
      { fields: ['assigneeUserId'] },
      { fields: ['dueDate'] },
    ],
  }
);

CaseTask.STATUSES = STATUSES;
CaseTask.PRIORITIES = PRIORITIES;

module.exports = CaseTask;
