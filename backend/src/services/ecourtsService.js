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
  let rawBodyForLog = '';
  const text = await res.text();
  const contentType = String(
    (res.headers && res.headers.get && res.headers.get('content-type')) || ''
  ).toLowerCase();
  const looksJson =
    contentType.includes('application/json') ||
    (text && /^\s*[\[{]/.test(text));
  if (text) {
    rawBodyForLog = text.slice(0, 1000);
    if (looksJson) {
      try {
        payload = JSON.parse(text);
      } catch {
        // Header claimed JSON but body isn't parseable. Treat as opaque.
        payload = null;
      }
    } else {
      // Non-JSON body (HTML error page, plaintext, an IIS 500 dump etc.)
      // — DO NOT promote it to `message` because the frontend would
      // display the entire blob. Leave payload null so the generic
      // upstream-down branch fires below.
      payload = null;
    }
  }

  if (!res.ok) {
    // Map common partner errors to friendlier messages while keeping the
    // status code intact so the browser can switch on it. Upstream may
    // return `message`, `error.message`, a nested `errors[].message`, or
    // a plain string — normalise to a single human-readable string so
    // we don't surface "[object Object]" to clients or logs.
    const pickStr = (v) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'object') {
        if (typeof v.message === 'string') return v.message;
        if (Array.isArray(v) && v.length > 0) return pickStr(v[0]);
        try {
          return JSON.stringify(v);
        } catch {
          return '';
        }
      }
      return String(v);
    };
    const upstreamMsg =
      pickStr(payload && payload.message) ||
      pickStr(payload && payload.error) ||
      pickStr(payload && payload.errors) ||
      '';
    const code =
      (payload && (payload.code || payload.errorCode)) ||
      (payload && payload.error && payload.error.code) ||
      null;
    // Always log the upstream status + a body excerpt server-side so we
    // can diagnose without ever surfacing the raw HTML to the visitor.
    try {
      console.warn(
        `[ecourts] upstream ${res.status} ${method} ${path}` +
          (upstreamMsg ? ` — ${upstreamMsg}` : ' — (no message)'),
        rawBodyForLog || '(empty body)'
      );
    } catch {
      /* logging must never throw */
    }
    // For 5xx + non-JSON responses (partner outage / IIS error page),
    // surface a generic outage message. Only JSON bodies with a usable
    // `message` are passed through verbatim to the client.
    const isPartnerOutage =
      res.status >= 500 || (!payload && !upstreamMsg);
    let clientMessage;
    if (code === 'INSUFFICIENT_CREDITS') {
      clientMessage = 'E-Courts India account is out of credits. Top up to continue.';
    } else if (code === 'RATE_LIMIT_EXCEEDED') {
      clientMessage = 'E-Courts India rate limit hit. Please slow down and retry.';
    } else if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED') {
      clientMessage =
        'E-Courts India API key is invalid or expired. Update it in Admin > Platform settings.';
    } else if (isPartnerOutage) {
      clientMessage =
        'The E-Courts India service is temporarily unavailable. Please try again in a few minutes.';
    } else {
      clientMessage = upstreamMsg || `E-Courts API error (HTTP ${res.status}).`;
    }
    throw {
      statusCode: isPartnerOutage ? 502 : res.status,
      message: clientMessage,
      upstreamCode: code,
      upstreamStatus: res.status,
    };
  }

  // 2xx but non-JSON body — also a sign of partner misbehaviour
  // (a CDN error caught with a 200, say). Don't return arbitrary HTML
  // to callers expecting JSON data.
  if (text && !payload) {
    try {
      console.warn(
        `[ecourts] upstream returned 2xx non-JSON ${method} ${path} ` +
          `(content-type=${contentType || 'unknown'})`,
        rawBodyForLog
      );
    } catch {
      /* logging must never throw */
    }
    throw {
      statusCode: 502,
      message:
        'The E-Courts India service returned an unexpected response. Please try again in a few minutes.',
      upstreamStatus: res.status,
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
 * AI-extracted analysis for a single order/judgment file. Returns:
 *   { markdown, aiAnalysis: { summary, keyPoints, outcome, relief, statutes } }
 * Upstream call takes 10-60 seconds the first time per file (it OCRs +
 * runs the LLM), then caches; subsequent calls are fast.
 */
async function getOrderAi(cnr, filename) {
  if (!cnr) throw { statusCode: 400, message: 'cnr is required.' };
  if (!filename) throw { statusCode: 400, message: 'filename is required.' };
  const basename = String(filename).split('/').filter(Boolean).pop() || '';
  const safeName = basename.replace(/[^A-Za-z0-9._-]/g, '');
  if (!safeName) throw { statusCode: 400, message: 'Invalid filename.' };
  const res = await callPartner(
    `/api/partner/case/${encodeURIComponent(cnr)}/order-ai/${encodeURIComponent(
      safeName
    )}`
  );
  const data = (res && res.data) || {};
  return {
    markdown:
      data.markdown ||
      data.markdownContent ||
      (data.files && (data.files.markdownContent || data.files.markdown)) ||
      '',
    aiAnalysis:
      data.aiAnalysis ||
      data.analysis ||
      data.ai ||
      (data.result && (data.result.aiAnalysis || data.result.analysis)) ||
      null,
  };
}

/**
 * Trigger an upstream rescrape and wait for it to settle. The partner
 * API returns immediately; metadata becomes visible within seconds via
 * `entityInfo.dateModified` ticking forward. We poll up to `maxWaitMs`,
 * then return whatever's freshest.
 */
/**
 * "Refresh-as-add" — useful when a user types a valid CNR that the
 * partner search index doesn't know yet. We POST /refresh, then poll
 * /case/{cnr} every 4s until either the case shows up or `maxWaitMs`
 * elapses. Returns the freshly-pulled `courtCaseData` blob, or null if
 * the upstream rescrape hasn't yielded anything in time.
 */
async function refreshAsAdd(cnr) {
  if (!cnr) throw { statusCode: 400, message: 'cnr is required.' };

  // Step 1 — direct case-detail probe. The partner SEARCH INDEX lags
  // 1-2 hours behind /case/{cnr}, so the case may already be in the
  // DB even though search returned no hits. Cheaper than refresh +
  // skips the 5-10 minute upstream wait when the case is already
  // cached.
  try {
    const data = await getCase(cnr);
    if (data && data.courtCaseData) {
      console.log(`[ecourts] ${cnr} resolved from partner cache (no refresh needed).`);
      return { ready: true, case: data, queue: null };
    }
  } catch (err) {
    // 404 here is the expected miss path — fall through to refresh.
    if (err && err.statusCode !== 404) throw err;
  }

  // Step 2 — kick an upstream rescrape. POST is mandatory (the docs
  // call out that GET returns 405). For unknown CNRs the partner API
  // queues a fresh scrape and responds with
  // `{status:"QUEUED", estimatedTime:"5-10 minutes"}`. We surface that
  // envelope to the client and let it poll /case/{cnr} from the
  // browser — the request handler can't reasonably stay open that long.
  console.log(`[ecourts] ${cnr} not in partner DB — POST /case/${cnr}/refresh.`);
  const queueRes = await callPartner(
    `/api/partner/case/${encodeURIComponent(cnr)}/refresh`,
    { method: 'POST' }
  );
  const queue = (queueRes && queueRes.data) || null;
  console.log(`[ecourts] ${cnr} upstream queue:`, JSON.stringify(queue));
  return { ready: false, case: null, queue };
}

async function requestRefresh(cnr, { maxWaitMs = 60000 } = {}) {
  if (!cnr) throw { statusCode: 400, message: 'cnr is required.' };
  // Capture the pre-refresh dateModified so we know when upstream
  // has actually settled the new copy.
  let before = null;
  try {
    const cur = await getCase(cnr);
    before =
      (cur && cur.entityInfo && cur.entityInfo.dateModified) ||
      (cur && cur.entityInfo && cur.entityInfo.lastUpdated) ||
      null;
  } catch {
    /* unknown CNR — refresh-as-add will pull it in below */
  }

  await callPartner(`/api/partner/case/${encodeURIComponent(cnr)}/refresh`, {
    method: 'POST',
  }).catch((err) => {
    // 404 here means the CNR was unknown AND upstream couldn't queue —
    // surface the error. Other transient errors fall through so we still
    // try a GET below.
    if (err && err.statusCode === 404) throw err;
  });

  const deadline = Date.now() + Math.max(5000, Number(maxWaitMs) || 60000);
  let latest = null;
  // Poll every 4s. The blog guide says metadata settles in seconds,
  // so 4s × 15 = 60s gives plenty of headroom without smashing rate
  // limits (each iteration costs one case-detail credit).
  while (Date.now() < deadline) {
    try {
      latest = await getCase(cnr);
      const after =
        (latest && latest.entityInfo && latest.entityInfo.dateModified) ||
        (latest && latest.entityInfo && latest.entityInfo.lastUpdated) ||
        null;
      if (after && (!before || String(after) !== String(before))) break;
    } catch {
      /* swallow transient — retry on next tick */
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  return latest;
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
  // Partner expects only the bare filename component (`order-1.pdf`).
  // The frontend sometimes passes a full path (e.g. `/orderDocuments/UP/...`)
  // when the upstream record stores it that way; strip down to the
  // basename so the path-segment encoding still works.
  const basename = String(filename).split('/').filter(Boolean).pop() || '';
  const safeName = basename.replace(/[^A-Za-z0-9._-]/g, '');
  if (!safeName) throw { statusCode: 400, message: 'Invalid filename.' };

  const res = await callPartner(
    `/api/partner/case/${encodeURIComponent(cnr)}/order-md/${encodeURIComponent(
      safeName
    )}`
  );
  const data = (res && res.data) || {};
  // Different partner endpoints return the PDF blob under different
  // keys — accept any of the known shapes.
  const b64 =
    data.pdfBase64 ||
    data.pdf ||
    data.fileContent ||
    data.content ||
    (data.files && (data.files.pdfBase64 || data.files.pdf || data.files.fileContent)) ||
    (data.file && (data.file.pdfBase64 || data.file.content)) ||
    null;
  if (!b64) {
    // Surface a slice of the upstream envelope so we can diagnose the
    // shape without leaking the full payload.
    try {
      console.warn(
        `[ecourts] getOrderPdf(${cnr}, ${safeName}) — no PDF in upstream response. keys=${Object.keys(
          data
        ).join(',')}`
      );
    } catch {
      /* logging must never throw */
    }
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
const { Op } = require('sequelize');
const sequelize = require('../config/database');
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
  // Match the CNR against any case the user owns — including ones
  // they created manually and later attached a CNR to. We drop the
  // legacy `source: 'ecourts'` filter so a CNR added via the case
  // edit form is still picked up here.
  const normalisedCnr = String(cnr).trim().toUpperCase();
  if (isProfessional) {
    const proKey = user.linkedId || user.id;
    const safe = String(proKey).replace(/'/g, "''");
    // Pro can be the primary `professionalId` or in the multi-assignee
    // `professionalIds` JSON array (firm-shared case).
    const row = await Case.findOne({
      where: {
        cnr: normalisedCnr,
        [Op.or]: [
          { professionalId: proKey },
          sequelize.literal(
            `JSON_CONTAINS(professionalIds, JSON_QUOTE('${safe}'))`
          ),
        ],
      },
    });
    return row ? row.get({ plain: true }) : null;
  }
  const row = await Case.findOne({
    where: { clientId: user.id, cnr: normalisedCnr },
  });
  return row ? row.get({ plain: true }) : null;
}

async function importCase(user, cnr, opts = {}) {
  if (!user || !user.id) {
    throw { statusCode: 401, message: 'Sign in required to save a case.' };
  }
  if (!cnr) throw { statusCode: 400, message: 'cnr is required.' };

  // Subscription gate — only blocks professionals with a caseLimit plan;
  // clients fall open (no `professionalId` linkage).
  await gates.enforceCanCreateCase(user.id);

  // De-dup: a single user shouldn't end up with two cases on the same
  // CNR. We reuse a row regardless of how it was created — the legacy
  // 'ecourts' source filter would miss a case the pro created
  // manually and later attached this CNR to.
  const role = String(user.role || '').toLowerCase();
  const isProfessional = role === 'professional';
  const dup = await findImportedCase(user, cnr);
  if (dup) {
    return { case: dup, reused: true };
  }

  // Fetch the full upstream blob so the new row carries a real snapshot.
  const detail = await getCase(cnr);
  const eciCase = (detail && detail.courtCaseData) || null;
  if (!eciCase) {
    throw { statusCode: 404, message: 'Case not found in E-Courts.' };
  }

  const mapped = mapEciToCaseFields(eciCase);
  // Optional client attachment — when a pro imports via the New-case
  // form's CNR lookup they pick the client(s) up front so we don't
  // end up with an orphan case row.
  const requestedClientIds = Array.isArray(opts.clientIds)
    ? [...new Set(opts.clientIds.map((s) => String(s || '').trim()).filter(Boolean))]
    : [];
  const ownerColumns = isProfessional
    ? {
        professionalId: user.linkedId || user.id,
        professionalIds: [user.linkedId || user.id],
        ...(requestedClientIds.length > 0
          ? { clientId: requestedClientIds[0], clientIds: requestedClientIds }
          : {}),
      }
    : { clientId: user.id, clientIds: [user.id] };

  // Optional caller overrides — the New-case form lets the pro edit
  // the prefilled fields before saving (e.g. retitle from "Petitioner
  // vs Respondent" to a friendlier label). Only a small whitelist is
  // accepted; everything else stays as the ECI-mapped value.
  const OVERRIDABLE = [
    'title',
    'category',
    'description',
    'priority',
    'caseNumber',
    'courtName',
    'opposingParty',
    'nextHearingDate',
  ];
  const overrides = {};
  if (opts.overrides && typeof opts.overrides === 'object') {
    for (const key of OVERRIDABLE) {
      const val = opts.overrides[key];
      // Treat empty string the same as absent — falling back to the
      // ECI-mapped value is almost always what the pro wants.
      if (val !== undefined && val !== null && val !== '') {
        overrides[key] = val;
      }
    }
  }

  const created = await Case.create({
    ...mapped,
    ...ownerColumns,
    ...overrides,
  });
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
  // Async refresh first — POSTs /case/{cnr}/refresh and polls
  // entityInfo.dateModified until upstream finishes rescraping the
  // source. Falls back to a plain GET if the refresh API times out.
  let detail = null;
  try {
    detail = await requestRefresh(row.cnr, { maxWaitMs: 45000 });
  } catch {
    detail = null;
  }
  if (!detail) {
    detail = await getCase(row.cnr);
  }
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

// -------------------------------------------------------------------------
// Causelist + free taxonomy. The court-structure endpoints don't consume
// credits per the API guide; the causelist search does (3 INR / 1 INR per
// call on PayG / Enterprise) so the controller leaves it auth-gated.
// -------------------------------------------------------------------------

async function getEnums(types) {
  // `/api/partner/enums` — free, cached upstream for ~1h. `types` is an
  // optional comma-separated whitelist (caseType, caseStatus, courtCode,
  // stateCode); empty means "everything".
  const res = await callPartner('/api/partner/enums', {
    query: types ? { types } : undefined,
  });
  return (res && res.data) || {};
}

async function getStates() {
  const res = await callPartner(
    '/api/CauseList/court-structure/states'
  );
  return (res && res.data) || [];
}

async function getDistricts(state) {
  if (!state) throw { statusCode: 400, message: 'state is required.' };
  const res = await callPartner(
    `/api/CauseList/court-structure/states/${encodeURIComponent(
      state
    )}/districts`
  );
  return (res && res.data) || [];
}

async function getComplexes(state, districtCode) {
  if (!state || !districtCode) {
    throw { statusCode: 400, message: 'state and districtCode are required.' };
  }
  const res = await callPartner(
    `/api/CauseList/court-structure/states/${encodeURIComponent(
      state
    )}/districts/${encodeURIComponent(districtCode)}/complexes`
  );
  return (res && res.data) || [];
}

async function getCourts(state, districtCode, complexCode) {
  if (!state || !districtCode || !complexCode) {
    throw {
      statusCode: 400,
      message: 'state, districtCode and courtComplexCode are required.',
    };
  }
  const res = await callPartner(
    `/api/CauseList/court-structure/states/${encodeURIComponent(
      state
    )}/districts/${encodeURIComponent(
      districtCode
    )}/complexes/${encodeURIComponent(complexCode)}/courts`
  );
  return (res && res.data) || [];
}

async function getCauselistAvailableDates({
  state,
  districtCode,
  courtComplexCode,
} = {}) {
  const res = await callPartner('/api/partner/causelist/available-dates', {
    query: {
      state: state || undefined,
      districtCode: districtCode || undefined,
      courtComplexCode: courtComplexCode || undefined,
    },
  });
  return (res && res.data) || { dates: [] };
}

async function searchCauselist(params = {}) {
  const allowed = [
    'q',
    'date',
    'startDate',
    'endDate',
    'judge',
    'advocate',
    'litigant',
    'state',
    'districtCode',
    'courtComplexCode',
    'court',
    'courtNo',
    'bench',
    'listType',
    'page',
    'pageSize',
  ];
  const query = {};
  for (const k of allowed) {
    const v = params[k];
    if (v === undefined || v === null || v === '') continue;
    query[k] = v;
  }
  const res = await callPartner('/api/partner/causelist/search', { query });
  return (res && res.data) || { results: [], totalHits: 0 };
}

module.exports = {
  search,
  getCase,
  getOrderPdf,
  getOrderAi,
  requestRefresh,
  refreshAsAdd,
  listFavorites,
  addFavorite,
  removeFavorite,
  findImportedCase,
  importCase,
  syncCase,
  getEnums,
  getStates,
  getDistricts,
  getComplexes,
  getCourts,
  getCauselistAvailableDates,
  searchCauselist,
};
