// Sequelize model: CaseUpdate
//   A timestamped entry in a case's timeline. Functions as both a
//   narrative log ("what happened") AND a task ("what still needs
//   doing") via the optional status / dueDate / priority columns —
//   setting any of them turns the update into a task surface visible
//   on the dashboard calendar.
//
//   Distinct from CaseNote (which is a plain text note): an update has
//   a `scheduledAt` (the date/time the update describes — defaults to
//   "now"), an optional `nextHearingDate`, an array of `attachments`,
//   and the optional task fields below.
//
//   Every saved nextHearingDate is mirrored to a CaseLog row so the
//   case's audit trail surfaces the full hearing history.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const jsonField = require('./jsonField');

const genId = () =>
  `cupd-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const CaseUpdate = sequelize.define(
  'CaseUpdate',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    caseId: { type: DataTypes.STRING(64), allowNull: false },
    // The professional who wrote the update.
    authorUserId: { type: DataTypes.STRING(64), allowNull: true },
    authorName: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    // Optional short title — useful when scanning the timeline.
    title: { type: DataTypes.STRING, allowNull: true },
    // Date/time the update describes. Defaults to NOW() on the server but
    // the user can pick a past/future moment.
    scheduledAt: { type: DataTypes.DATE, allowNull: false },
    // Free-text body.
    body: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    // Optional next hearing date the update is recording.
    nextHearingDate: { type: DataTypes.DATEONLY, allowNull: true },
    // Array of { url, name, type, size } describing each attached file.
    attachments: jsonField('attachments', []),

    // --- Task fields (optional) ---------------------------------------
    // An update becomes a "task" the moment any of these are set. The
    // dashboard calendar lists every update with a dueDate as a
    // teal pill against that date; the case timeline shows a status
    // chip + priority on each row.
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'done', 'cancelled'),
      allowNull: true,
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high'),
      allowNull: true,
    },
    dueDate: { type: DataTypes.DATEONLY, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    completedByUserId: { type: DataTypes.STRING(64), allowNull: true },

    // Google Calendar event id mirroring this task into the
    // professional's Google Calendar. Only populated when dueDate is
    // set (pure-narration updates have nothing to put on a calendar).
    googleEventId: { type: DataTypes.STRING(128), allowNull: true },
  },
  {
    tableName: 'case_updates',
    timestamps: true,
    indexes: [
      { fields: ['caseId'] },
      { fields: ['authorUserId'] },
      { fields: ['scheduledAt'] },
      { fields: ['dueDate'] },
      { fields: ['caseId', 'status'] },
    ],
  }
);

CaseUpdate.STATUSES = ['open', 'in_progress', 'done', 'cancelled'];
CaseUpdate.PRIORITIES = ['low', 'normal', 'high'];

module.exports = CaseUpdate;
