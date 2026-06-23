// clientDocumentService — orchestrates uploads + visibility for the
// per-client document store. Uses the shared storageService so files
// land in the same S3 bucket as the rest of the platform.
//
// Visibility model:
//   * client          — sees ALL their documents
//   * uploaderUserId  — sees their own uploads
//   * other pros      — see nothing unless ClientDocumentAccess
//                       row for (client, professional) is 'granted'
//
// All operations resolve the caller's role via the resolveActor()
// helper because a single user can be a client to one pro AND a pro
// to other people simultaneously.

const { Op } = require('sequelize');
const fs = require('fs');
const {
  ClientDocument,
  ClientDocumentAccess,
  ProfessionalDetail,
  ProfessionalClient,
} = require('../models');
const storageService = require('./storageService');

async function resolveProId(userId) {
  const detail = await ProfessionalDetail.findOne({
    where: { userId },
    attributes: ['id'],
    raw: true,
  });
  return detail ? detail.id : null;
}

/**
 * Check whether `actor` (signed-in user) can see the client's whole
 * document set. Returns:
 *   { isClient: true }  — they ARE the client
 *   { isPro: true, professionalId, granted: bool }
 *      — pro, with `granted` true when access is 'granted', false otherwise
 *   null — no access path
 */
async function resolveActor(actorUserId, clientUserId) {
  if (!actorUserId) return null;
  if (actorUserId === clientUserId) return { isClient: true };
  const proId = await resolveProId(actorUserId);
  if (!proId) return null;
  // Is the pro linked to this client at all? If not, they can't even
  // request access.
  const link = await ProfessionalClient.findOne({
    where: { professionalId: proId, clientUserId },
    raw: true,
  });
  if (!link) return null;
  const access = await ClientDocumentAccess.findOne({
    where: { professionalId: proId, clientUserId },
    raw: true,
  });
  return {
    isPro: true,
    professionalId: proId,
    granted: !!(access && access.status === 'granted'),
    accessRow: access,
  };
}

// --- Documents -------------------------------------------------------

async function listForClient(actorUserId, clientUserId) {
  const actor = await resolveActor(actorUserId, clientUserId);
  if (!actor) {
    throw { statusCode: 403, message: 'You do not have access to this client.' };
  }
  // Client always sees everything.
  // Pro: must have an EXPLICIT 'granted' status to see ANY documents
  // — including ones they uploaded themselves. If the client never
  // granted access, denied, or revoked it, the pro's view is empty.
  // (This intentionally hides their own uploads too, per the
  // "client owns the bucket" model.)
  if (actor.isPro && !actor.granted) {
    return [];
  }
  const rows = await ClientDocument.findAll({
    where: { clientUserId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  return rows;
}

async function uploadOne(actorUserId, clientUserId, file, meta = {}) {
  const actor = await resolveActor(actorUserId, clientUserId);
  if (!actor) {
    throw { statusCode: 403, message: 'You do not have access to this client.' };
  }
  // Pros must have granted access to add to the client's document
  // bucket — there's no point uploading what they wouldn't be able
  // to see afterwards. Clients uploading their own docs always pass.
  if (actor.isPro && !actor.granted) {
    throw {
      statusCode: 403,
      message:
        'You need the client to grant access before you can upload to their document store.',
    };
  }
  if (!file || !file.path) {
    throw { statusCode: 422, message: 'No file received.' };
  }
  // Hard 1 MB per-file cap for the client document store. Bank
  // statements / Form 16 / etc. should be export-PDFs, not scanned
  // images — keeps S3 cost predictable and the consent screen
  // friendly. Caller can split into multiple uploads for the same
  // doc + FY combo if they need to.
  const ONE_MB = 1 * 1024 * 1024;
  if (file.size && file.size > ONE_MB) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    throw {
      statusCode: 413,
      message: `File too large — keep each upload under 1 MB. "${file.originalname}" was ${(file.size / 1024 / 1024).toFixed(2)} MB.`,
    };
  }
  // Read the file from the temp path multer wrote it to; storageService
  // accepts a buffer.
  const buffer = fs.readFileSync(file.path);
  // Push to storage — type 'document' lands under documents/ prefix on
  // S3 (per storageService.TYPE_TO_PREFIX) which is already on the
  // PRIVATE_PREFIXES list so reads go via presigned URLs.
  const stored = await storageService.uploadFile({
    buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
    type: 'document',
  });
  // Best-effort cleanup of the multer temp file.
  try {
    fs.unlinkSync(file.path);
  } catch {
    /* swallow */
  }
  // Validate financialYear when present — expected format 'YYYY-YY',
  // e.g. '2025-26'. Anything else is dropped so the DB stays clean.
  let financialYear = null;
  if (meta.financialYear) {
    const fy = String(meta.financialYear).trim();
    if (/^\d{4}-\d{2}$/.test(fy)) financialYear = fy;
  }

  const row = await ClientDocument.create({
    clientUserId,
    uploaderUserId: actorUserId,
    docKey: String(meta.docKey || 'other').slice(0, 60),
    label: meta.label ? String(meta.label).slice(0, 200) : null,
    storagePath: stored.storedPath || stored.path || stored.key || stored,
    fileName: file.originalname || null,
    mimeType: file.mimetype || null,
    size: file.size || null,
    notes: meta.notes ? String(meta.notes).slice(0, 5000) : null,
    financialYear,
  });
  return row.get({ plain: true });
}

async function getDocumentUrl(actorUserId, docId) {
  const doc = await ClientDocument.findOne({ where: { id: docId }, raw: true });
  if (!doc) throw { statusCode: 404, message: 'Document not found.' };
  const actor = await resolveActor(actorUserId, doc.clientUserId);
  if (!actor) {
    throw { statusCode: 403, message: 'You do not have access.' };
  }
  // Pros must have granted access to view ANY document — including
  // ones they uploaded themselves. The client owns the bucket; if
  // they pull access, the pro loses sight of the bucket entirely.
  if (actor.isPro && !actor.granted) {
    throw {
      statusCode: 403,
      message:
        'You no longer have access to this client\'s document store. Ask the client to grant access.',
    };
  }
  const url = await storageService.getFileUrl(doc.storagePath, {
    expiryMinutes: 15,
  });
  return { url, doc };
}

async function deleteDocument(actorUserId, docId) {
  const doc = await ClientDocument.findOne({ where: { id: docId } });
  if (!doc) throw { statusCode: 404, message: 'Document not found.' };
  const plain = doc.get({ plain: true });
  const actor = await resolveActor(actorUserId, plain.clientUserId);
  if (!actor) {
    throw { statusCode: 403, message: 'You do not have access.' };
  }
  // Only the uploader or the client themselves can delete a document.
  const canDelete =
    actor.isClient || (actor.isPro && plain.uploaderUserId === actorUserId);
  if (!canDelete) {
    throw {
      statusCode: 403,
      message: 'Only the uploader or the client can delete this document.',
    };
  }
  // Best-effort file deletion — row removal is the source of truth.
  try {
    await storageService.deleteFile(plain.storagePath);
  } catch {
    /* swallow */
  }
  await doc.destroy();
  return { id: docId };
}

// --- Access requests ------------------------------------------------

async function requestAccess(proUserId, clientUserId, note) {
  const actor = await resolveActor(proUserId, clientUserId);
  if (!actor || !actor.isPro) {
    throw {
      statusCode: 403,
      message: 'Only the linked professional can request document access.',
    };
  }
  const existing = await ClientDocumentAccess.findOne({
    where: { clientUserId, professionalId: actor.professionalId },
  });
  if (existing) {
    // Already granted? Nothing to do.
    if (existing.status === 'granted') return existing.get({ plain: true });
    // Otherwise refresh the request — push back to 'pending'.
    await existing.update({
      status: 'pending',
      requestedAt: new Date(),
      decidedAt: null,
      requestNote: note ? String(note).slice(0, 255) : null,
      decisionNote: null,
      professionalUserId: proUserId,
    });
    return existing.get({ plain: true });
  }
  const row = await ClientDocumentAccess.create({
    clientUserId,
    professionalId: actor.professionalId,
    professionalUserId: proUserId,
    status: 'pending',
    requestedAt: new Date(),
    requestNote: note ? String(note).slice(0, 255) : null,
  });
  return row.get({ plain: true });
}

async function decideAccess(clientUserIdActor, accessId, decision, note) {
  const row = await ClientDocumentAccess.findByPk(accessId);
  if (!row) throw { statusCode: 404, message: 'Access request not found.' };
  if (row.clientUserId !== clientUserIdActor) {
    throw {
      statusCode: 403,
      message: 'Only the client can grant / deny / revoke document access.',
    };
  }
  if (!['granted', 'denied', 'revoked'].includes(decision)) {
    throw {
      statusCode: 422,
      message: 'decision must be one of: granted, denied, revoked',
    };
  }
  await row.update({
    status: decision,
    decidedAt: new Date(),
    decisionNote: note ? String(note).slice(0, 255) : null,
  });
  return row.get({ plain: true });
}

/**
 * Pro-side: status of my access requests across all my linked
 * clients. Lets the manage page render "Pending / Granted / Denied"
 * pills next to each client.
 */
async function listAccessForPro(proUserId) {
  const proId = await resolveProId(proUserId);
  if (!proId) return [];
  return ClientDocumentAccess.findAll({
    where: { professionalId: proId },
    order: [['updatedAt', 'DESC']],
    raw: true,
  });
}

/**
 * Client-side: list every access record scoped to me — drives the
 * "pending requests" list + the "currently granted" list on the
 * client compliance page.
 */
async function listAccessForClient(clientUserId) {
  return ClientDocumentAccess.findAll({
    where: { clientUserId },
    order: [['updatedAt', 'DESC']],
    raw: true,
  });
}

/**
 * Pro-specific access record between (this pro, this client). Used
 * by the manage page to decide whether to show "Request access" vs
 * "Request pending" vs "You have access".
 */
async function getProAccessForClient(proUserId, clientUserId) {
  const proId = await resolveProId(proUserId);
  if (!proId) return null;
  return ClientDocumentAccess.findOne({
    where: { professionalId: proId, clientUserId },
    raw: true,
  });
}

module.exports = {
  listForClient,
  uploadOne,
  getDocumentUrl,
  deleteDocument,
  requestAccess,
  decideAccess,
  listAccessForPro,
  listAccessForClient,
  getProAccessForClient,
};
