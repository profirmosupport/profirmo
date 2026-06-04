// ecourtsService — server-side proxy to https://webapi.ecourtsindia.com.
//
// The partner API key is sensitive (per-account quota + billing) so it
// never leaves the backend. The browser hits /api/ecourts/* which calls
// out using the key stored in admin settings (`ecourtsApiKey`).

const adminSettings = require('./adminSettingsService');

const BASE_URL = 'https://webapi.ecourtsindia.com';

async function getKey() {
  const key = await adminSettings.getString('ecourtsApiKey');
  if (!key) {
    throw {
      statusCode: 503,
      message:
        'E-Courts India is not configured. Add an API key under Admin > Platform settings > E-Courts India.',
    };
  }
  return key;
}

function buildQuery(params = {}) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      // partner API expects array filters as repeated keys or comma-joined;
      // their docs use repeated values for arrays in courtCodes etc.
      v.filter(Boolean).forEach((x) => out.append(k, String(x)));
    } else {
      out.append(k, String(v));
    }
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

async function callPartner(path, { query, method = 'GET' } = {}) {
  const key = await getKey();
  const url = `${BASE_URL}${path}${buildQuery(query)}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    throw {
      statusCode: 502,
      message:
        'Unable to reach the E-Courts India API. The upstream service may be down — please try again in a few minutes.',
    };
  }

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!res.ok) {
    // Map common partner errors to friendlier messages while keeping the
    // status code intact so the browser can switch on it.
    const upstreamMsg =
      (payload && (payload.message || payload.error)) ||
      `E-Courts API error (HTTP ${res.status}).`;
    const code = payload && (payload.code || payload.errorCode);
    throw {
      statusCode: res.status,
      message:
        code === 'INSUFFICIENT_CREDITS'
          ? 'E-Courts India account is out of credits. Top up to continue.'
          : code === 'RATE_LIMIT_EXCEEDED'
            ? 'E-Courts India rate limit hit. Please slow down and retry.'
            : code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED'
              ? 'E-Courts India API key is invalid or expired. Update it in Admin > Platform settings.'
              : upstreamMsg,
      upstreamCode: code,
    };
  }

  return payload;
}

/**
 * Search cases. Forwards the request params verbatim — see ecourtsService
 * docs for the full filter list. Returns the upstream `data` envelope which
 * contains `results`, `totalHits`, `page`, `pageSize`, etc.
 */
async function search(params = {}) {
  const allowed = [
    'query',
    'advocates',
    'judges',
    'petitioners',
    'respondents',
    'litigants',
    'courtCodes',
    'caseTypes',
    'caseStatuses',
    'caseCategories',
    'judicialSections',
    'benchTypes',
    'filingDateFrom',
    'filingDateTo',
    'decisionDateFrom',
    'decisionDateTo',
    'page',
    'pageSize',
  ];
  const query = {};
  for (const k of allowed) {
    if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
      query[k] = params[k];
    }
  }
  const res = await callPartner('/api/partner/search', { query });
  return (res && res.data) || { results: [], totalHits: 0 };
}

/**
 * Fetch a single case by its CNR (16-char id). Returns the upstream
 * `data` block which contains `courtCaseData`, `entityInfo`, `files`.
 */
async function getCase(cnr) {
  if (!cnr || !/^[A-Za-z0-9-]{8,32}$/.test(String(cnr))) {
    throw { statusCode: 400, message: 'Invalid CNR.' };
  }
  const res = await callPartner(
    `/api/partner/case/${encodeURIComponent(cnr)}`
  );
  return (res && res.data) || null;
}

/**
 * Fetch the actual PDF binary of an order/judgment for a case. The partner
 * API returns the watermarked PDF as base64 inside the `/order-md/`
 * endpoint — we decode and stream it back as a real `application/pdf`
 * response so the browser can save/preview it directly.
 *
 * @returns {Promise<{ pdfBuffer: Buffer, downloadFilename: string, markdownContent?: string }>}
 */
async function getOrderPdf(cnr, filename) {
  if (!cnr) throw { statusCode: 400, message: 'cnr is required.' };
  if (!filename) throw { statusCode: 400, message: 'filename is required.' };
  // The partner API expects the bare filename (e.g. "order-1.pdf").
  const safeName = String(filename).replace(/[^A-Za-z0-9._-]/g, '');
  if (!safeName) throw { statusCode: 400, message: 'Invalid filename.' };

  const res = await callPartner(
    `/api/partner/case/${encodeURIComponent(cnr)}/order-md/${encodeURIComponent(
      safeName
    )}`
  );
  const data = (res && res.data) || {};
  const b64 =
    data.pdfBase64 ||
    (data.files && data.files.pdfBase64) ||
    null;
  if (!b64) {
    throw {
      statusCode: 502,
      message:
        'E-Courts returned no PDF for this order. The document may still be processing — please retry in a minute.',
    };
  }
  const pdfBuffer = Buffer.from(String(b64).replace(/\s+/g, ''), 'base64');
  const downloadFilename =
    data.downloadFilename ||
    `ecourtsindia-${cnr}-${safeName}`;
  return {
    pdfBuffer,
    downloadFilename,
    markdownContent: data.markdownContent || null,
  };
}

// -------------------------------------------------------------------------
// Local persistence helpers: favourites + full-case import + sync.
// -------------------------------------------------------------------------
const { ECourtsFavorite, Case } = require('../models');
const gates = require('./subscriptionGateService');

/** List the current user's starred cases (newest first). */
async function listFavorites(userId) {
  const rows = await ECourtsFavorite.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  return rows;
}

/**
 * Star a case. Re-running on the same (userId, cnr) refreshes the cached
 * display fields without throwing.
 */
async function addFavorite(userId, cnr, snapshotData = null) {
  if (!userId) throw { statusCode: 401, message: 'Sign in required.' };
  if (!cnr) throw { statusCode: 400, message: 'cnr is required.' };
  // If the caller didn't pass a snapshot, fetch one so the dashboard row
  // has something useful to display.
  let snap = snapshotData;
  if (!snap) {
    try {
      const data = await getCase(cnr);
      snap = data && data.courtCaseData;
    } catch {
      snap = null;
    }
  }
  const display = pickDisplayFields(snap);
  const existing = await ECourtsFavorite.findOne({ where: { userId, cnr } });
  if (existing) {
    await existing.update(display);
    return existing.get({ plain: true });
  }
  const row = await ECourtsFavorite.create({ userId, cnr, ...display });
  return row.get({ plain: true });
}

async function removeFavorite(userId, cnr) {
  await ECourtsFavorite.destroy({ where: { userId, cnr } });
}

function pickDisplayFields(snap) {
  if (!snap || typeof snap !== 'object') return {};
  const title =
    (Array.isArray(snap.petitioners) && snap.petitioners[0]) || null;
  return {
    title,
    caseType: snap.caseType || null,
    caseStatus: snap.caseStatus || null,
    courtCode: snap.courtCode || snap.courtName || null,
    filingDate: snap.filingDate || null,
    nextHearingDate: snap.nextHearingDate || null,
  };
}

/**
 * Pull the most useful E-Courts fields out of the partner case detail
 * and shape them into a Case-model row payload. Reused by both
 * importCase (creates a new row) and syncCase (updates an existing).
 */
function mapEciToCaseFields(eciCase) {
  if (!eciCase) return {};
  const petitioners = Array.isArray(eciCase.petitioners)
    ? eciCase.petitioners.filter(Boolean)
    : [];
  const respondents = Array.isArray(eciCase.respondents)
    ? eciCase.respondents.filter(Boolean)
    : [];
  const title =
    petitioners[0] && respondents[0]
      ? `${petitioners[0]} vs ${respondents[0]}`
      : petitioners[0] || eciCase.cnr || 'E-Courts case';
  return {
    title,
    caseNumber: eciCase.caseNumber || eciCase.filingNumber || null,
    courtName: eciCase.courtName || eciCase.courtCode || null,
    opposingParty: respondents[0] || null,
    nextHearingDate: eciCase.nextHearingDate || null,
    category: eciCase.judicialSection || eciCase.caseCategory || 'Litigation',
    description: Array.isArray(eciCase.actsAndSections)
      ? eciCase.actsAndSections.filter(Boolean).join(', ')
      : '',
    status: String(eciCase.caseStatus || '').toLowerCase().includes('disposed')
      ? 'closed'
      : 'open',
    cnr: eciCase.cnr || null,
    caseType: eciCase.caseType || null,
    courtCode: eciCase.courtCode || null,
    state: eciCase.state || null,
    district: eciCase.district || null,
    filingDate: eciCase.filingDate || null,
    decisionDate: eciCase.decisionDate || null,
    petitioners,
    respondents,
    judges: Array.isArray(eciCase.judges) ? eciCase.judges : [],
    petitionerAdvocates: Array.isArray(eciCase.petitionerAdvocates)
      ? eciCase.petitionerAdvocates
      : [],
    respondentAdvocates: Array.isArray(eciCase.respondentAdvocates)
      ? eciCase.respondentAdvocates
      : [],
    actsAndSections: Array.isArray(eciCase.actsAndSections)
      ? eciCase.actsAndSections
      : [],
    eciSnapshot: eciCase,
    eciSyncedAt: new Date(),
    source: 'ecourts',
  };
}

/**
 * Import an E-Courts case into the user's own Cases module. Both clients
 * and professionals can import. Professionals are gated by
 * plan.caseLimit via subscriptionGateService.
 *
 * Sets the owner column based on the user's role: clients land in
 * `clientId`, everyone else in `professionalId` (when they have a
 * legacy professional linkage).
 */
/**
 * Look up whether the current user already has a Case row imported for
 * this CNR. The dashboard "Save to my cases" CTA switches to a
 * "Check in my cases" link based on this — saves a round-trip to the
 * upstream API on revisits.
 */
async function findImportedCase(user, cnr) {
  if (!user || !user.id || !cnr) return null;
  const role = String(user.role || '').toLowerCase();
  const isProfessional = role === 'professional';
  const where = isProfessional
    ? { professionalId: user.linkedId || user.id, cnr, source: 'ecourts' }
    : { clientId: user.id, cnr, source: 'ecourts' };
  const row = await Case.findOne({ where });
  return row ? row.get({ plain: true }) : null;
}

async function importCase(user, cnr) {
  if (!user || !user.id) {
    throw { statusCode: 401, message: 'Sign in required to save a case.' };
  }
  if (!cnr) throw { statusCode: 400, message: 'cnr is required.' };

  // Subscription gate — only blocks professionals with a caseLimit plan;
  // clients fall open (no `professionalId` linkage).
  await gates.enforceCanCreateCase(user.id);

  // De-dup: a single user shouldn't import the same CNR twice. Look up by
  // (owner, cnr) and reuse the existing case if found.
  const role = String(user.role || '').toLowerCase();
  const isProfessional = role === 'professional';
  const ownerWhere = isProfessional
    ? { professionalId: user.linkedId || user.id }
    : { clientId: user.id };

  const dup = await Case.findOne({
    where: { ...ownerWhere, cnr, source: 'ecourts' },
  });
  if (dup) {
    return { case: dup.get({ plain: true }), reused: true };
  }

  // Fetch the full upstream blob so the new row carries a real snapshot.
  const detail = await getCase(cnr);
  const eciCase = (detail && detail.courtCaseData) || null;
  if (!eciCase) {
    throw { statusCode: 404, message: 'Case not found in E-Courts.' };
  }

  const mapped = mapEciToCaseFields(eciCase);
  const ownerColumns = isProfessional
    ? {
        professionalId: user.linkedId || user.id,
        professionalIds: [user.linkedId || user.id],
      }
    : { clientId: user.id, clientIds: [user.id] };

  const created = await Case.create({ ...mapped, ...ownerColumns });
  return { case: created.get({ plain: true }), reused: false };
}

/**
 * Re-pull an E-Courts case and overwrite the local snapshot. Returns the
 * fresh case row + a structured diff describing what changed since the
 * previous snapshot — used by the "Update from E-Court" modal.
 */
async function syncCase(caseId, user) {
  if (!user || !user.id) {
    throw { statusCode: 401, message: 'Sign in required.' };
  }
  const row = await Case.findByPk(caseId);
  if (!row) throw { statusCode: 404, message: 'Case not found.' };
  if (row.source !== 'ecourts' || !row.cnr) {
    throw {
      statusCode: 400,
      message: 'This case was not imported from E-Courts.',
    };
  }

  const oldSnap = row.eciSnapshot || {};
  const detail = await getCase(row.cnr);
  const eciCase = (detail && detail.courtCaseData) || null;
  if (!eciCase) {
    throw {
      statusCode: 502,
      message: 'E-Courts did not return a fresh copy of this case.',
    };
  }

  const diff = computeDiff(oldSnap, eciCase);
  const mapped = mapEciToCaseFields(eciCase);
  await row.update(mapped);
  return { case: row.get({ plain: true }), diff };
}

// ---- Diff helpers --------------------------------------------------------

const SIMPLE_FIELDS = [
  ['caseStatus', 'Case status'],
  ['nextHearingDate', 'Next hearing'],
  ['decisionDate', 'Decision date'],
  ['caseType', 'Case type'],
  ['courtName', 'Court'],
];

function computeDiff(prev, next) {
  prev = prev && typeof prev === 'object' ? prev : {};
  const changes = [];
  for (const [key, label] of SIMPLE_FIELDS) {
    const a = prev[key] || '';
    const b = next[key] || '';
    if (String(a) !== String(b)) {
      changes.push({ field: label, from: a || '—', to: b || '—' });
    }
  }
  const newOrders = newItems(
    [...(prev.interimOrders || []), ...(prev.judgmentOrders || [])],
    [...(next.interimOrders || []), ...(next.judgmentOrders || [])],
    (o) => `${o.orderDate || ''}|${o.orderUrl || o.filename || ''}`
  );
  const newHearings = newItems(
    prev.historyOfCaseHearings || [],
    next.historyOfCaseHearings || [],
    (h) =>
      `${h.hearingDate || h.businessOnDate || ''}|${h.purposeOfListing || ''}`
  );
  return {
    isFirstSync: !prev || Object.keys(prev).length === 0,
    fieldChanges: changes,
    newOrders,
    newHearings,
    hasAnyChange:
      changes.length > 0 || newOrders.length > 0 || newHearings.length > 0,
  };
}

function newItems(prev, next, keyFn) {
  const seen = new Set(prev.map(keyFn));
  return next.filter((x) => !seen.has(keyFn(x)));
}

module.exports = {
  search,
  getCase,
  getOrderPdf,
  listFavorites,
  addFavorite,
  removeFavorite,
  findImportedCase,
  importCase,
  syncCase,
};
