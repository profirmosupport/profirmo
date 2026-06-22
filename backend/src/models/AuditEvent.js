// AuditEvent — append-only audit log row. Captures every state change
// that matters for compliance + dispute resolution: who did it, when,
// from which IP, on what entity, plus the before/after JSON payloads.
//
// Design intent:
//   * **Append-only.** Service code only ever creates rows here; we
//     deliberately do NOT expose update / destroy. If a regulator (or a
//     bar council audit) ever asks "what changed and who did it", the
//     answer is in this table.
//   * **Soft links to entities.** `entityType` is a short string
//     ('case', 'booking', 'payment', 'reminder', 'case_task', …) and
//     `entityId` is the public id of the touched row. No FKs because
//     the audit trail must survive even if the underlying row is
//     hard-deleted.
//   * **JSON before / after.** `before` is null for creates, `after` is
//     null for deletes; both populated for updates. Caller is expected
//     to pass only the changed columns (or whole-row snapshots — both
//     work).

const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/database');

const genId = () =>
  `aud-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

const ACTIONS = ['create', 'update', 'delete', 'restore', 'login', 'logout', 'export', 'access_denied'];

const AuditEvent = sequelize.define(
  'AuditEvent',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    actorUserId: { type: DataTypes.STRING(64), allowNull: true },
    actorRole: { type: DataTypes.STRING(40), allowNull: true },
    ip: { type: DataTypes.STRING(64), allowNull: true },
    userAgent: { type: DataTypes.STRING(255), allowNull: true },
    entityType: { type: DataTypes.STRING(40), allowNull: false },
    entityId: { type: DataTypes.STRING(64), allowNull: false },
    action: {
      type: DataTypes.ENUM(...ACTIONS),
      allowNull: false,
    },
    before: { type: DataTypes.JSON, allowNull: true },
    after: { type: DataTypes.JSON, allowNull: true },
    summary: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: 'audit_events',
    timestamps: true,
    updatedAt: false, // append-only — no updates ever happen
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    indexes: [
      { fields: ['entityType', 'entityId'] },
      { fields: ['actorUserId'] },
      { fields: ['createdAt'] },
    ],
  }
);

AuditEvent.ACTIONS = ACTIONS;

module.exports = AuditEvent;
