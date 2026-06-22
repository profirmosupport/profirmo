const { Op, literal: sequelizeLiteralFor } = require('sequelize');
const {
  Case,
  File,
  CaseNote,
  CaseLog,
  CaseUpdate,
  User,
  ProfessionalDetail,
  LawFirm,
  FirmMember,
} = require('../models');
const { paginate } = require('./professionalService');
const firmService = require('./firmService');
const notificationService = require('./notificationService');

// Fire-and-forget notification — failures never break the request.
const notify = async (params) => {
  try {
    await notificationService.createNotification(params);
  } catch (err) {
    console.warn(`[caseNotify] failed: ${err.message}`);
  }
};

// Resolve the public professional id (user.linkedId || detail.id) -> userId
// so we can target a notification at the assigned professional.
const resolveProfessionalUserId = async (publicProfId) => {
  if (!publicProfId) return null;
  // Try linkedId first (legacy/back-fill style ids like prof-N).
  const byLinked = await User.findOne({
    where: { linkedId: publicProfId },
    raw: true,
  });
  if (byLinked) return byLinked.id;
  // Otherwise treat the id as a ProfessionalDetail.id.
  const detail = await ProfessionalDetail.findByPk(publicProfId, { raw: true });
  return detail ? detail.userId : null;
};

const displayName = (u) =>
  (u && (u.fullName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    u.name)) || '';

/**
 * Notify every stakeholder on a case — its client(s) and every assigned
 * professional — with role-aware deep links to the right dashboard. Skips
 * the actor (who already knows what they did) and de-dupes user ids so a
 * user wearing two hats only gets one notification.
 *
 * @param {object} caseRow - the Case (decorated or raw — uses clientIds[],
 *   professionalIds[], and falls back to the singular fields).
 * @param {object} actor   - the actor doing the action (skipped from notify).
 * @param {{ type, title, message, metadata? }} payload
 */
const notifyCaseStakeholders = async (caseRow, actor, payload) => {
  if (!caseRow || !payload) return;

  // Collect client user ids (already users.id values).
  const clientIds = new Set();
  if (Array.isArray(caseRow.clientIds)) {
    for (const id of caseRow.clientIds) if (id) clientIds.add(id);
  }
  if (caseRow.clientId) clientIds.add(caseRow.clientId);

  // Collect professional public ids and resolve each to a user id.
  const proPublicIds = new Set();
  if (Array.isArray(caseRow.professionalIds)) {
    for (const id of caseRow.professionalIds) if (id) proPublicIds.add(id);
  }
  if (caseRow.professionalId) proPublicIds.add(caseRow.professionalId);
  const proUserIds = (
    await Promise.all([...proPublicIds].map((pid) => resolveProfessionalUserId(pid)))
  ).filter(Boolean);

  // De-dupe; exclude the actor so they don't ping themselves.
  const recipientIds = new Set([...clientIds, ...proUserIds]);
  if (actor && actor.id) recipientIds.delete(actor.id);
  if (recipientIds.size === 0) return;

  // Resolve roles in one query so we can pick the right dashboard link.
  const rows = await User.findAll({
    where: { id: { [Op.in]: [...recipientIds] } },
    attributes: ['id', 'role'],
    raw: true,
  });
  const linkForRole = (role) => {
    if (role === 'client') return `/dashboard/client/cases/${caseRow.id}`;
    return `/dashboard/professional/cases/${caseRow.id}`;
  };
  await Promise.all(
    rows.map((u) =>
      notify({
        userId: u.id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: linkForRole(u.role),
        metadata: { caseId: caseRow.id, ...(payload.metadata || {}) },
      })
    )
  );
};

/** Write a single CaseLog row. Failures are non-fatal. */
const writeLog = async (caseId, actor, action, message, metadata) => {
  try {
    // The JWT only carries id/role/linkedId — never the full name. So
    // displayName(actor) is empty for any caller that passes req.user
    // directly. Resolve from the User row when that happens so the
    // case timeline shows the real person, not "System".
    let actorName = displayName(actor);
    if (!actorName && actor && actor.id) {
      try {
        const u = await User.findByPk(actor.id, { raw: true });
        actorName = displayName(u);
      } catch {
        /* swallow — lookup failure shouldn't break log write */
      }
    }
    await CaseLog.create({
      caseId,
      actorUserId: (actor && actor.id) || null,
      actorName: actorName || '',
      action,
      message: message || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (err) {
    // best-effort log
    console.warn(`[caseLog] failed: ${err.message}`);
  }
};

// Attach the related `files` array to a plain case object so JSON responses
// keep the same shape the frontend expects.
const withFiles = async (caseObj) => {
  if (!caseObj) return caseObj;
  const files = await File.findAll({
    where: { caseId: caseObj.id },
    raw: true,
  });
  return { ...caseObj, files };
};

// Resolve clientId(s) (users.id) → `{ id, name, phone, email, city }` so the
// frontend can display them without a second round-trip. Populates BOTH:
//   - `client`  — the primary client (back-compat for single-client surfaces)
//   - `clients` — the full multi-client array (new code reads this)
const attachClients = async (cases) => {
  if (!Array.isArray(cases) || cases.length === 0) return cases;
  // Collect every id referenced by either `clientId` or `clientIds[]`.
  const all = new Set();
  for (const c of cases) {
    if (c.clientId) all.add(c.clientId);
    if (Array.isArray(c.clientIds)) {
      for (const id of c.clientIds) if (id) all.add(id);
    }
  }
  if (all.size === 0) {
    return cases.map((c) => ({ ...c, client: null, clients: [] }));
  }
  const users = await User.findAll({
    where: { id: { [Op.in]: [...all] } },
    raw: true,
  });
  const byId = new Map(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        name: displayName(u),
        phone: u.mobileNumber || '',
        email: u.email || '',
        city: u.city || '',
      },
    ])
  );
  return cases.map((c) => {
    const idList =
      Array.isArray(c.clientIds) && c.clientIds.length > 0
        ? c.clientIds
        : c.clientId
          ? [c.clientId]
          : [];
    const clients = idList.map((id) => byId.get(id)).filter(Boolean);
    return {
      ...c,
      client: byId.get(c.clientId) || clients[0] || null,
      clients,
    };
  });
};

const attachClient = async (caseObj) => {
  if (!caseObj) return caseObj;
  const [decorated] = await attachClients([caseObj]);
  return decorated;
};

// Resolve assignee public ids to display objects. Populates BOTH:
//   - `professional`   — primary assignee (back-compat)
//   - `professionals`  — the full multi-assignee array
const attachProfessionals = async (cases) => {
  if (!Array.isArray(cases) || cases.length === 0) return cases;
  const all = new Set();
  for (const c of cases) {
    if (c.professionalId) all.add(c.professionalId);
    if (Array.isArray(c.professionalIds)) {
      for (const id of c.professionalIds) if (id) all.add(id);
    }
  }
  if (all.size === 0) {
    return cases.map((c) => ({ ...c, professional: null, professionals: [] }));
  }
  const pids = [...all];
  const userIds = await Promise.all(
    pids.map((pid) => resolveProfessionalUserId(pid))
  );
  const validUserIds = userIds.filter(Boolean);
  const userRows = validUserIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: validUserIds } },
        raw: true,
      })
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const viewByPid = new Map();
  pids.forEach((pid, i) => {
    const uid = userIds[i];
    const u = uid ? userById.get(uid) : null;
    viewByPid.set(pid, {
      id: pid,
      publicId: pid,
      userId: uid || null,
      name: displayName(u) || pid,
      email: (u && u.email) || '',
      profilePhoto: (u && u.profilePhoto) || null,
    });
  });
  return cases.map((c) => {
    const idList =
      Array.isArray(c.professionalIds) && c.professionalIds.length > 0
        ? c.professionalIds
        : c.professionalId
          ? [c.professionalId]
          : [];
    const professionals = idList.map((id) => viewByPid.get(id)).filter(Boolean);
    return {
      ...c,
      professional:
        viewByPid.get(c.professionalId) || professionals[0] || null,
      professionals,
    };
  });
};

// Run both decorators (files + client + professional) on a single case.
const decorate = async (caseObj) => {
  if (!caseObj) return caseObj;
  const withClient = await attachClient(await withFiles(caseObj));
  const [withPro] = await attachProfessionals([withClient]);
  return withPro;
};

// Run both decorators on an array of cases.
const decorateAll = async (cases) => {
  const withClients = await attachClients(await Promise.all(cases.map(withFiles)));
  return attachProfessionals(withClients);
};

// Persist an array of file descriptors as File rows for a given case.
const saveFiles = async (caseId, files) => {
  if (!Array.isArray(files) || files.length === 0) return;
  const rows = files.map((f) => ({
    ...(f.id ? { id: f.id } : {}),
    caseId,
    name: f.name || '',
    size: f.size === undefined || f.size === null ? '' : String(f.size),
    type: f.type || 'application/octet-stream',
    uploadedAt: f.uploadedAt || new Date().toISOString(),
  }));
  await File.bulkCreate(rows);
};

/**
 * List cases with optional filters and pagination.
 * Supported filters: status, category, clientId, professionalId, firmId.
 * @returns {Promise<{ items, page, limit, total }>}
 */
const list = async ({ filters = {}, page, limit } = {}) => {
  const { page: p, limit: l, offset } = paginate(page, limit);
  const where = {};

  if (filters.status) where.status = String(filters.status);
  if (filters.category) where.category = String(filters.category);
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (filters.firmId) where.firmId = filters.firmId;

  const { rows, count } = await Case.findAndCountAll({
    where,
    limit: l,
    offset,
    raw: true,
  });

  const items = await decorateAll(rows);
  return { items, page: p, limit: l, total: count };
};

/** Find a case by id (with files), or null when not found. */
const getById = async (id) => {
  const found = await Case.findByPk(id, { raw: true });
  if (!found) return null;
  return decorate(found);
};

/** Create a new case record. Auto-logs the creation. */
const create = async (data = {}, actor = null) => {
  // Accept either `clientIds` (array, multi-client) or legacy `clientId`
  // (single string). Normalise both so the DB stores both fields in sync.
  const rawIds = Array.isArray(data.clientIds)
    ? data.clientIds
    : data.clientId
      ? [data.clientId]
      : [];
  const clientIds = [
    ...new Set(rawIds.map((s) => String(s || '').trim()).filter(Boolean)),
  ];
  const primaryClientId = clientIds[0] || data.clientId || null;

  // Multi-assignee: accept `professionalIds[]` or single `professionalId`.
  const rawProIds = Array.isArray(data.professionalIds)
    ? data.professionalIds
    : data.professionalId
      ? [data.professionalId]
      : [];
  const professionalIds = [
    ...new Set(rawProIds.map((s) => String(s || '').trim()).filter(Boolean)),
  ];
  const primaryProfessionalId =
    professionalIds[0] || data.professionalId || null;

  const newCase = await Case.create({
    clientId: primaryClientId,
    clientIds,
    professionalId: primaryProfessionalId,
    professionalIds,
    firmId: data.firmId || null,
    title: data.title,
    category: data.category,
    status: data.status || 'open',
    description: data.description || null,
    priority: data.priority || 'medium',
    caseNumber: data.caseNumber || null,
    courtName: data.courtName || null,
    opposingParty: data.opposingParty || null,
    nextHearingDate: data.nextHearingDate || null,
    assignedByUserId:
      primaryProfessionalId && actor
        ? actor.id
        : data.assignedByUserId || null,
    assignedAt: primaryProfessionalId ? new Date() : null,
    // Optional back-link to the booking that produced this case. Set by
    // the convert-to-case flow so a second conversion attempt can be
    // deduped + redirected to the existing case.
    bookingId: data.bookingId || null,
  });

  if (Array.isArray(data.files) && data.files.length > 0) {
    await saveFiles(newCase.id, data.files);
  }

  // Resolve client names so the audit log is human-readable.
  const clientLookup =
    clientIds.length > 0
      ? await User.findAll({
          where: { id: { [Op.in]: clientIds } },
          raw: true,
        })
      : [];
  const clientNameById = new Map(
    clientLookup.map((u) => [u.id, displayName(u) || u.id])
  );
  const clientLabels = clientIds
    .map((id) => `${clientNameById.get(id) || id} (${id})`)
    .filter(Boolean);
  const clientSummary =
    clientLabels.length === 0
      ? 'no clients'
      : clientLabels.length === 1
        ? `client ${clientLabels[0]}`
        : `clients ${clientLabels.join(', ')}`;

  await writeLog(
    newCase.id,
    actor,
    'created',
    `Case "${newCase.title}" created for ${clientSummary}.`,
    {
      status: newCase.status,
      priority: newCase.priority,
      clientIds,
      clientNames: clientIds.map((id) => clientNameById.get(id) || ''),
    }
  );
  if (professionalIds.length > 0) {
    // Resolve every assignee's user id + display name in parallel so the
    // log message reads "Assigned to A (id), B (id)." and each gets notified.
    const userIds = await Promise.all(
      professionalIds.map((pid) => resolveProfessionalUserId(pid))
    );
    const userRows = await User.findAll({
      where: { id: { [Op.in]: userIds.filter(Boolean) } },
      raw: true,
    });
    const userById = new Map(userRows.map((u) => [u.id, u]));
    const assignees = professionalIds.map((pid, i) => {
      const uid = userIds[i];
      const name = uid && userById.has(uid)
        ? displayName(userById.get(uid)) || pid
        : pid;
      return { publicId: pid, userId: uid || null, name };
    });
    const summary = assignees
      .map((a) => `${a.name} (${a.publicId})`)
      .join(', ');
    await writeLog(
      newCase.id,
      actor,
      'assigned',
      `Assigned to ${summary}.`,
      {
        professionalIds,
        professionalNames: assignees.map((a) => a.name),
      }
    );
    // Notify every assignee who isn't the actor.
    for (const a of assignees) {
      if (a.userId && (!actor || a.userId !== actor.id)) {
        await notify({
          userId: a.userId,
          type: 'case_assigned',
          title: 'New case assigned',
          message: `You have been assigned "${newCase.title}".`,
          link: `/dashboard/professional/cases/${newCase.id}`,
          metadata: { caseId: newCase.id },
        });
      }
    }
  }

  // Notify every CLIENT on the new case. Professionals already received
  // the more specific `case_assigned` notification above; clients get a
  // `case_created` ping so they know a new case has been filed for them.
  // Skip the actor if they happen to be one of the clients.
  if (clientIds.length > 0) {
    // Build a readable assignee summary so the notification reads
    // "Filed with Priya Nair, Adv. Kabir Khan." rather than raw ids.
    let assigneeSummary = '';
    if (professionalIds.length > 0) {
      const userIds = await Promise.all(
        professionalIds.map((pid) => resolveProfessionalUserId(pid))
      );
      const rows = userIds.filter(Boolean).length
        ? await User.findAll({
            where: { id: { [Op.in]: userIds.filter(Boolean) } },
            raw: true,
          })
        : [];
      const userById = new Map(rows.map((u) => [u.id, u]));
      assigneeSummary = professionalIds
        .map((pid, i) => displayName(userById.get(userIds[i])) || pid)
        .join(', ');
    }
    for (const cid of clientIds) {
      if (actor && actor.id === cid) continue;
      await notify({
        userId: cid,
        type: 'case_created',
        title: 'New case filed for you',
        message: assigneeSummary
          ? `A case "${newCase.title}" has been opened with ${assigneeSummary}.`
          : `A case "${newCase.title}" has been opened.`,
        link: `/dashboard/client/cases/${newCase.id}`,
        metadata: { caseId: newCase.id },
      });
    }
  }

  return decorate(newCase.get({ plain: true }));
};

/** Update an existing case record. Returns null when not found. */
const update = async (id, data = {}, actor = null) => {
  const found = await Case.findByPk(id);
  if (!found) return null;

  const updatable = [
    'professionalId',
    'firmId',
    'title',
    'category',
    'status',
    'description',
    'priority',
    'caseNumber',
    'courtName',
    'opposingParty',
    'nextHearingDate',
  ];
  const changes = {};
  const prevValues = found.get({ plain: true });
  updatable.forEach((field) => {
    if (data[field] !== undefined && data[field] !== prevValues[field]) {
      changes[field] = data[field];
    }
  });

  // Multi-client: accept `clientIds` array. Mirror the primary id into the
  // legacy `clientId` column so all surfaces stay consistent.
  if (Array.isArray(data.clientIds)) {
    const cleaned = [
      ...new Set(
        data.clientIds.map((s) => String(s || '').trim()).filter(Boolean)
      ),
    ];
    const prevList = Array.isArray(prevValues.clientIds)
      ? prevValues.clientIds
      : [];
    const sameList =
      cleaned.length === prevList.length &&
      cleaned.every((v, i) => v === prevList[i]);
    if (!sameList) {
      changes.clientIds = cleaned;
      changes.clientId = cleaned[0] || null;
    }
  }

  // Multi-assignee: accept `professionalIds` array. Mirror the primary id
  // into the legacy `professionalId` column.
  let multiAssigneeChanged = false;
  let prevAssigneeList = Array.isArray(prevValues.professionalIds)
    ? prevValues.professionalIds
    : prevValues.professionalId
      ? [prevValues.professionalId]
      : [];
  let newAssigneeList = prevAssigneeList;
  if (Array.isArray(data.professionalIds)) {
    const cleaned = [
      ...new Set(
        data.professionalIds.map((s) => String(s || '').trim()).filter(Boolean)
      ),
    ];
    const sameList =
      cleaned.length === prevAssigneeList.length &&
      cleaned.every((v, i) => v === prevAssigneeList[i]);
    if (!sameList) {
      changes.professionalIds = cleaned;
      changes.professionalId = cleaned[0] || null;
      newAssigneeList = cleaned;
      multiAssigneeChanged = true;
    }
  }

  if (Object.keys(changes).length > 0) {
    if (changes.professionalId !== undefined) {
      changes.assignedByUserId = actor ? actor.id : null;
      changes.assignedAt = new Date();
    }
    await found.update(changes);

    // Emit a separate log entry per meaningful change.
    if (changes.status) {
      await writeLog(
        id,
        actor,
        'status_changed',
        `Status changed from "${prevValues.status}" to "${changes.status}".`,
        { from: prevValues.status, to: changes.status }
      );
    }
    // Either a single-`professionalId` update OR a multi `professionalIds`
    // update triggers the reassignment log. We diff the two assignee lists
    // and emit one log entry that shows the full before/after, then notify
    // every NEWLY added assignee.
    if (changes.professionalId !== undefined || multiAssigneeChanged) {
      if (!multiAssigneeChanged) {
        // Single-id update path: derive newAssigneeList from the change.
        newAssigneeList = changes.professionalId ? [changes.professionalId] : [];
        changes.assignedByUserId = actor ? actor.id : null;
        changes.assignedAt = new Date();
      } else {
        changes.assignedByUserId = actor ? actor.id : null;
        changes.assignedAt = newAssigneeList.length > 0 ? new Date() : null;
      }

      // Resolve display names for every old + new assignee.
      const allPids = [...new Set([...prevAssigneeList, ...newAssigneeList])];
      const userIds = await Promise.all(
        allPids.map((pid) => resolveProfessionalUserId(pid))
      );
      const pidToUserId = new Map(allPids.map((pid, i) => [pid, userIds[i]]));
      const userRows = userIds.filter(Boolean).length
        ? await User.findAll({
            where: { id: { [Op.in]: userIds.filter(Boolean) } },
            raw: true,
          })
        : [];
      const userById = new Map(userRows.map((u) => [u.id, u]));
      const labelOf = (pid) => {
        const uid = pidToUserId.get(pid);
        const u = uid ? userById.get(uid) : null;
        return `${displayName(u) || pid} (${pid})`;
      };
      const prevAssigneeIds = new Set(prevAssigneeList);
      const newAssigneeIds = new Set(newAssigneeList);
      const added = newAssigneeList.filter((p) => !prevAssigneeIds.has(p));
      const removed = prevAssigneeList.filter((p) => !newAssigneeIds.has(p));

      const fromLabel =
        prevAssigneeList.length === 0
          ? 'unassigned'
          : prevAssigneeList.map(labelOf).join(', ');
      const toLabel =
        newAssigneeList.length === 0
          ? 'unassigned'
          : newAssigneeList.map(labelOf).join(', ');
      await writeLog(
        id,
        actor,
        'assigned',
        `Case re-assigned: ${fromLabel} -> ${toLabel}.`,
        {
          from: prevAssigneeList,
          to: newAssigneeList,
          added,
          removed,
        }
      );

      // Notify every NEWLY-added assignee (not the actor doing the reassign).
      for (const pid of added) {
        const uid = pidToUserId.get(pid);
        if (uid && (!actor || uid !== actor.id)) {
          await notify({
            userId: uid,
            type: 'case_assigned',
            title: 'Case assigned to you',
            message: `You have been assigned "${found.title}".`,
            link: `/dashboard/professional/cases/${id}`,
            metadata: { caseId: id },
          });
        }
      }
    }
    const otherChanged = Object.keys(changes).filter(
      (k) =>
        ![
          'status',
          'professionalId',
          'professionalIds',
          'assignedByUserId',
          'assignedAt',
        ].includes(k)
    );
    if (otherChanged.length > 0) {
      await writeLog(
        id,
        actor,
        'updated',
        `Updated: ${otherChanged.join(', ')}.`,
        { fields: otherChanged }
      );
    }
  }

  // If a files array is supplied, replace the case's file rows.
  if (data.files !== undefined) {
    await File.destroy({ where: { caseId: id } });
    await saveFiles(id, Array.isArray(data.files) ? data.files : []);
  }

  return decorate(found.get({ plain: true }));
};

/**
 * Set a case's stage / pipeline. Validates against the pipelines
 * defined in seeds/compliance-rules.json (via config/caseStages). Both
 * stageType and stage may be patched independently; an unknown
 * pipeline resets stage to null. Logs the change to case_log so it
 * shows up in the case timeline alongside hearings + updates.
 */
const caseStages = require('../config/caseStages');
const setStage = async (id, payload = {}, actor = null) => {
  const found = await Case.findByPk(id);
  if (!found) return null;

  // Common-stages model — just `stage`. stageType is preserved on the
  // row for backward-compat with any rows written under the old
  // per-pipeline scheme but is no longer driven by callers.
  const stage = caseStages.normalize(payload.stage);

  const prevStage = found.stage;
  await found.update({ stage, stageUpdatedAt: new Date() });

  const fromLabel = caseStages.labelFor(prevStage);
  const toLabel = caseStages.labelFor(stage);
  await writeLog(
    id,
    actor,
    'stage_changed',
    fromLabel
      ? `Stage: ${fromLabel} → ${toLabel || '(cleared)'}`
      : toLabel
        ? `Stage set to ${toLabel}`
        : 'Stage cleared',
    { from: { stage: prevStage }, to: { stage } }
  );

  return decorate(found.get({ plain: true }));
};

/** Delete a case record (and its files). Returns the removed case or null. */
const remove = async (id) => {
  const found = await Case.findByPk(id, { raw: true });
  if (!found) return null;
  const removed = await decorate(found);
  await File.destroy({ where: { caseId: id } });
  await Case.destroy({ where: { id } });
  return removed;
};

/** Get all cases for a given client (with files + client info). */
const getByClient = async (clientId) => {
  const rows = await Case.findAll({ where: { clientId }, raw: true });
  return decorateAll(rows);
};

/** Get all cases for a given professional (with files + client info). */
const getByProfessional = async (professionalId) => {
  const rows = await Case.findAll({
    where: { professionalId },
    raw: true,
  });
  return decorateAll(rows);
};

/** Resolve the caller's public professional id (user.linkedId || detail.id). */
const resolveActorProfessionalId = async (user) => {
  if (!user || !user.id) return null;
  if (user.linkedId) return user.linkedId;
  const detail = await ProfessionalDetail.findOne({
    where: { userId: user.id },
    raw: true,
  });
  return detail ? detail.id : null;
};

/** Resolve the public firm id (legacyFirmId || law_firms.id) the user owns. */
const resolveActorFirmId = async (user) => {
  if (!user || !user.id) return null;
  const firm = await LawFirm.findOne({
    where: { ownerUserId: user.id },
    raw: true,
  });
  if (firm) return firm.legacyFirmId || firm.id;
  // Also check co-owner / member firm membership.
  const detail = await ProfessionalDetail.findOne({
    where: { userId: user.id },
    raw: true,
  });
  if (!detail) return null;
  const member = await FirmMember.findOne({
    where: { professionalId: detail.id, status: 'active' },
    raw: true,
  });
  if (!member) return null;
  const lf = await LawFirm.findByPk(member.firmId, { raw: true });
  return lf ? lf.legacyFirmId || lf.id : null;
};

/**
 * Cases assigned to the calling professional. Matches the user's public
 * professional aliases (linkedId + detail.id) against:
 *   - the primary `professionalId` column (single-assignee or back-compat), OR
 *   - the `professionalIds` JSON array (multi-assignee).
 */
const listMine = async (user) => {
  if (!user || !user.id) return [];

  // Build the full alias list — both linkedId (legacy) and detail.id.
  const aliases = new Set();
  if (user.linkedId) aliases.add(user.linkedId);
  const detail = await ProfessionalDetail.findOne({
    where: { userId: user.id },
    raw: true,
  });
  if (detail) aliases.add(detail.id);
  if (aliases.size === 0) return [];

  const aliasList = [...aliases];

  // Match the primary column directly.
  const primaryRows = await Case.findAll({
    where: { professionalId: { [Op.in]: aliasList } },
    raw: true,
  });

  // Match the JSON array column via JSON_CONTAINS — one literal per alias.
  // Single-quoted JSON_QUOTE() input is safe because all alias values come
  // from internal id columns (`prof-N`, `pdetail-...`), never user input.
  const literalClauses = aliasList.map((a) => {
    const safe = String(a).replace(/'/g, "''");
    return sequelizeLiteralFor(`JSON_CONTAINS(professionalIds, JSON_QUOTE('${safe}'))`);
  });
  const jsonRows = literalClauses.length
    ? await Case.findAll({ where: { [Op.or]: literalClauses }, raw: true })
    : [];

  // Merge + dedupe.
  const byId = new Map();
  for (const r of [...primaryRows, ...jsonRows]) byId.set(r.id, r);
  const rows = [...byId.values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  return decorateAll(rows);
};

/** Cases where the caller is the client (clientId = users.id, role='client'). */
const listMineAsClient = async (user) => {
  if (!user || user.role !== 'client') return [];

  // Match either the primary `clientId` column or the `clientIds` JSON
  // array — so a client sees every case they're a party to, not only the
  // ones where they're the "primary" client.
  const safe = String(user.id).replace(/'/g, "''");
  const rows = await Case.findAll({
    where: {
      [Op.or]: [
        { clientId: user.id },
        sequelizeLiteralFor(
          `JSON_CONTAINS(clientIds, JSON_QUOTE('${safe}'))`
        ),
      ],
    },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  // OR branches can occasionally return duplicates — dedupe by id.
  const byId = new Map();
  for (const r of rows) byId.set(r.id, r);
  return decorateAll([...byId.values()]);
};

/**
 * Cases for the caller's firm (owner / co-owner / member). Returns the union
 * of:
 *   - cases tagged with `firmId` directly, AND
 *   - cases whose assigned professional is any active firm member (so a
 *     member's individually-created case still surfaces here even if they
 *     forgot to tag the firm).
 */
const listForFirm = async (user) => {
  const firmId = await resolveActorFirmId(user);
  if (!firmId) return { firmId: null, items: [] };

  // Build the alias list of every active firm member's public professional
  // id so we can match either the primary `professionalId` column OR the
  // `professionalIds` JSON array.
  const memberAliasIds = await firmService.getFirmProfessionalIds(firmId);

  const orClauses = [{ firmId }];
  if (memberAliasIds.length > 0) {
    orClauses.push({ professionalId: { [Op.in]: memberAliasIds } });
    for (const a of memberAliasIds) {
      const safe = String(a).replace(/'/g, "''");
      orClauses.push(
        sequelizeLiteralFor(
          `JSON_CONTAINS(professionalIds, JSON_QUOTE('${safe}'))`
        )
      );
    }
  }

  const rows = await Case.findAll({
    where: orClauses.length > 1 ? { [Op.or]: orClauses } : { firmId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  // Sequelize may return duplicates across OR branches — dedupe by id.
  const byId = new Map();
  for (const r of rows) byId.set(r.id, r);
  const items = await decorateAll([...byId.values()]);
  return { firmId, items };
};

// --- Notes -----------------------------------------------------------------

/**
 * Append a note to a case. Accepts either the legacy 3-arg signature
 * `(caseId, user, body)` or a 3-arg `(caseId, user, { body, attachments })`
 * payload so the new file-attachment flow can pass extras without breaking
 * existing callers.
 */
const addNote = async (caseId, user, payload) => {
  // Normalise the call shape.
  const data =
    typeof payload === 'string' || payload === null || payload === undefined
      ? { body: payload }
      : payload;
  const body = data && data.body;
  const attachments = Array.isArray(data && data.attachments)
    ? data.attachments.filter((a) => a && (a.url || a.name))
    : [];

  if (!body || !String(body).trim()) {
    throw { statusCode: 422, message: 'Note body is required.' };
  }
  const found = await Case.findByPk(caseId);
  if (!found) throw { statusCode: 404, message: 'Case not found.' };

  // The JWT only carries id/role/linkedId/firmId, so a DB lookup is needed
  // for the actor's display name. Falls back to 'Member' only when the
  // row is somehow missing or fully empty.
  let authorName = displayName(user);
  if (!authorName && user && user.id) {
    const u = await User.findByPk(user.id, { raw: true });
    authorName = displayName(u);
  }

  const note = await CaseNote.create({
    caseId,
    authorUserId: (user && user.id) || null,
    authorName: authorName || 'Member',
    body: String(body).trim(),
    attachments,
  });
  await writeLog(caseId, user, 'note_added', 'A note was added.', {
    noteId: note.id,
    attachmentCount: attachments.length,
  });

  // Notify every stakeholder (client + assigned pros) so they don't miss
  // case activity. Fire-and-forget — the note has already persisted.
  const preview = String(body).trim().slice(0, 120);
  const caseRow = found.get({ plain: true });
  const attachSuffix =
    attachments.length > 0
      ? ` (${attachments.length} attachment${attachments.length === 1 ? '' : 's'})`
      : '';
  notifyCaseStakeholders(caseRow, user, {
    type: 'case_note_added',
    title: `New note on "${caseRow.title || 'case'}"`,
    message: `${authorName || 'A team member'} added a note: ${preview}${
      String(body).trim().length > 120 ? '…' : ''
    }${attachSuffix}`,
    metadata: { noteId: note.id },
  }).catch(() => {});
  return note.get({ plain: true });
};

/** Notes for a case, newest first. */
const listNotes = async (caseId) =>
  CaseNote.findAll({
    where: { caseId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

/**
 * Edit a note's body and/or attachments. Accepts either the legacy 3-arg
 * `(noteId, user, body)` shape or a `(noteId, user, { body, attachments })`
 * payload. Returns null when the note is missing.
 */
const editNote = async (noteId, user, payload) => {
  const data =
    typeof payload === 'string' || payload === null || payload === undefined
      ? { body: payload }
      : payload;

  const note = await CaseNote.findByPk(noteId);
  if (!note) return null;

  const patch = {};
  if (data.body !== undefined) {
    const next = String(data.body || '').trim();
    if (!next) throw { statusCode: 422, message: 'Note body is required.' };
    patch.body = next;
  }
  if (Array.isArray(data.attachments)) {
    patch.attachments = data.attachments.filter(
      (a) => a && (a.url || a.name)
    );
  }

  await note.update(patch);
  await writeLog(note.caseId, user, 'note_edited', 'A note was edited.', {
    noteId: note.id,
  });
  return note.get({ plain: true });
};

/** Delete a note. Logs the deletion. Returns null when missing. */
const deleteNote = async (noteId, user) => {
  const note = await CaseNote.findByPk(noteId);
  if (!note) return null;
  const { caseId, id } = note.get({ plain: true });
  await note.destroy();
  await writeLog(caseId, user, 'note_deleted', 'A note was deleted.', {
    noteId: id,
  });
  return { id, caseId };
};

/** Log entries for a case, newest first. */
const listLog = async (caseId) =>
  CaseLog.findAll({
    where: { caseId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

// --- Updates ---------------------------------------------------------------

/**
 * Append a richer "update" to a case — date/time + body + optional next
 * hearing date + an array of attachment descriptors. Mirrors the hearing
 * date (if any) to the audit log so every scheduled hearing is preserved.
 *
 * @param {string} caseId
 * @param {object} user - the authenticated actor (the professional writing
 *   the update). `id`, `fullName/name` are read.
 * @param {object} data - { body, scheduledAt, nextHearingDate, attachments[] }
 */
const addUpdate = async (caseId, user, data = {}) => {
  // Body is optional now that an update can be a pure task (title + due
  // date alone). Require at least one of body, title, dueDate.
  const hasBody = data.body && String(data.body).trim();
  const hasTitle = data.title && String(data.title).trim();
  const hasDueDate = !!data.dueDate;
  if (!hasBody && !hasTitle && !hasDueDate) {
    throw {
      statusCode: 422,
      message: 'Add a title, body, or due date for the update.',
    };
  }
  const found = await Case.findByPk(caseId);
  if (!found) throw { statusCode: 404, message: 'Case not found.' };

  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
  const attachments = Array.isArray(data.attachments)
    ? data.attachments.filter((a) => a && (a.url || a.name))
    : [];

  // Resolve the actor's full name — the JWT only carries id/role/linkedId,
  // so fall back to a DB lookup so updates always show a readable name.
  let authorName = displayName(user);
  if (!authorName && user && user.id) {
    const u = await User.findByPk(user.id, { raw: true });
    authorName = displayName(u);
  }

  // Task fields — optional. Any one of status / dueDate / priority being
  // set turns this update into a task row visible on the calendar.
  const status = data.status && CaseUpdate.STATUSES.includes(data.status)
    ? data.status
    : null;
  const priority = data.priority && CaseUpdate.PRIORITIES.includes(data.priority)
    ? data.priority
    : null;
  const dueDate =
    data.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(data.dueDate))
      ? data.dueDate
      : null;

  const update = await CaseUpdate.create({
    caseId,
    authorUserId: (user && user.id) || null,
    authorName: authorName || '',
    title: data.title ? String(data.title).trim() : null,
    scheduledAt,
    body: hasBody ? String(data.body).trim() : '',
    nextHearingDate: data.nextHearingDate || null,
    attachments,
    status,
    priority,
    dueDate,
    completedAt: status === 'done' ? new Date() : null,
    completedByUserId: status === 'done' && user ? user.id : null,
  });

  // If a hearing date is provided, also push it to the case itself so the
  // listing's "Next hearing" column stays current.
  if (data.nextHearingDate) {
    try {
      await found.update({ nextHearingDate: data.nextHearingDate });
    } catch (err) {
      console.warn(`[caseUpdate] could not sync nextHearingDate: ${err.message}`);
    }
  }

  // Mirror to the audit log so the full history is queryable in one place.
  await writeLog(
    caseId,
    user,
    'update_added',
    data.nextHearingDate
      ? `Update added. Next hearing on ${data.nextHearingDate}.`
      : 'Update added.',
    {
      updateId: update.id,
      nextHearingDate: data.nextHearingDate || null,
      attachmentCount: attachments.length,
    }
  );

  // Notify every stakeholder. Fire-and-forget — the update is already saved.
  const preview = String(data.body).trim().slice(0, 120);
  const headline = data.title
    ? `Update: ${String(data.title).trim()}`
    : `${authorName || 'A team member'} posted an update`;
  const caseRow = found.get({ plain: true });
  notifyCaseStakeholders(caseRow, user, {
    type: 'case_update_added',
    title: `${headline} on "${caseRow.title || 'case'}"`,
    message: data.nextHearingDate
      ? `${preview}${String(data.body).trim().length > 120 ? '…' : ''} (Next hearing ${data.nextHearingDate})`
      : `${preview}${String(data.body).trim().length > 120 ? '…' : ''}`,
    metadata: {
      updateId: update.id,
      nextHearingDate: data.nextHearingDate || null,
    },
  }).catch(() => {});

  return update.get({ plain: true });
};

/** List every update for a case, newest first. */
const listUpdates = async (caseId) =>
  CaseUpdate.findAll({
    where: { caseId },
    order: [['scheduledAt', 'DESC']],
    raw: true,
  });

/**
 * Edit an existing update. Only the author (or a future authorised actor)
 * should reach here — for now any signed-in user may edit. Returns null if
 * the update isn't found. Mirrors a fresh nextHearingDate to the case + log.
 */
const editUpdate = async (updateId, user, data = {}) => {
  const row = await CaseUpdate.findByPk(updateId);
  if (!row) return null;

  const patch = {};
  if (data.title !== undefined) {
    patch.title = data.title ? String(data.title).trim() : null;
  }
  if (data.body !== undefined) {
    const next = String(data.body || '').trim();
    if (!next) throw { statusCode: 422, message: 'Update body is required.' };
    patch.body = next;
  }
  if (data.scheduledAt !== undefined) {
    patch.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
  }
  if (data.nextHearingDate !== undefined) {
    patch.nextHearingDate = data.nextHearingDate || null;
  }
  if (Array.isArray(data.attachments)) {
    patch.attachments = data.attachments.filter(
      (a) => a && (a.url || a.name)
    );
  }
  // Task-field patches — null clears, value sets, undefined leaves alone.
  if (data.status !== undefined) {
    const next = data.status && CaseUpdate.STATUSES.includes(data.status)
      ? data.status
      : null;
    patch.status = next;
    if (next === 'done' && row.status !== 'done') {
      patch.completedAt = new Date();
      patch.completedByUserId = user ? user.id : null;
    } else if (next !== 'done' && row.status === 'done') {
      patch.completedAt = null;
      patch.completedByUserId = null;
    }
  }
  if (data.priority !== undefined) {
    patch.priority = data.priority && CaseUpdate.PRIORITIES.includes(data.priority)
      ? data.priority
      : null;
  }
  if (data.dueDate !== undefined) {
    patch.dueDate =
      data.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(data.dueDate))
        ? data.dueDate
        : null;
  }
  await row.update(patch);

  // If the next hearing date changed, sync it to the case + log it.
  if (data.nextHearingDate !== undefined) {
    try {
      const c = await Case.findByPk(row.caseId);
      if (c) await c.update({ nextHearingDate: data.nextHearingDate || null });
    } catch (err) {
      console.warn(`[caseUpdate] could not sync nextHearingDate: ${err.message}`);
    }
  }

  await writeLog(
    row.caseId,
    user,
    'update_edited',
    `Update edited: ${row.title || (row.body || '').slice(0, 40)}.`,
    { updateId: row.id }
  );

  return row.get({ plain: true });
};

/** Delete a case update. Logs the deletion. Returns null when missing. */
const deleteUpdate = async (updateId, user) => {
  const row = await CaseUpdate.findByPk(updateId);
  if (!row) return null;
  const { caseId, id, title, body } = row.get({ plain: true });
  await row.destroy();
  await writeLog(
    caseId,
    user,
    'update_deleted',
    `Update deleted: ${title || (body || '').slice(0, 40)}.`,
    { updateId: id }
  );
  return { id, caseId };
};

/**
 * Authorization gate for everything that touches case-scoped resources
 * (notes, updates, file attachments). Returns true when the caller is:
 *   - the case's client (primary clientId, or in clientIds[])
 *   - an assigned professional (linkedId or detail.id match)
 *   - a member of the case's firm
 *   - a platform admin
 * Returns false otherwise. The case row itself is also returned so the
 * caller can avoid a second DB lookup.
 */
async function userCanAccessCase(user, caseId) {
  if (!user || !user.id || !caseId) return { allowed: false, case: null };
  const c = await Case.findByPk(caseId, { raw: true });
  if (!c) return { allowed: false, case: null };

  // Platform admins see every case.
  if (user.role === 'platform_admin' || user.role === 'admin') {
    return { allowed: true, case: c };
  }

  // Client side: matches primary clientId OR clientIds[] JSON array.
  if (c.clientId === user.id) return { allowed: true, case: c };
  const clientIds = Array.isArray(c.clientIds) ? c.clientIds : [];
  if (clientIds.includes(user.id)) return { allowed: true, case: c };

  // Professional / firm side: build alias list and match against
  // primary professionalId + professionalIds[] JSON array.
  const aliases = new Set();
  if (user.linkedId) aliases.add(user.linkedId);
  const detail = await ProfessionalDetail.findOne({
    where: { userId: user.id },
    raw: true,
  });
  if (detail) aliases.add(detail.id);
  if (aliases.size > 0) {
    if (c.professionalId && aliases.has(c.professionalId)) {
      return { allowed: true, case: c };
    }
    const profIds = Array.isArray(c.professionalIds) ? c.professionalIds : [];
    if (profIds.some((id) => aliases.has(id))) {
      return { allowed: true, case: c };
    }
  }

  // Firm membership: if the case carries a firmId, allow if the user is
  // a member of that firm.
  if (c.firmId) {
    const userFirmId = await resolveActorFirmId(user);
    if (userFirmId && String(userFirmId) === String(c.firmId)) {
      return { allowed: true, case: c };
    }
  }

  return { allowed: false, case: c };
}

module.exports = {
  list,
  getById,
  create,
  update,
  setStage,
  remove,
  getByClient,
  getByProfessional,
  listMine,
  listMineAsClient,
  listForFirm,
  addNote,
  listNotes,
  editNote,
  deleteNote,
  listLog,
  addUpdate,
  listUpdates,
  editUpdate,
  deleteUpdate,
  userCanAccessCase,
};
