// attestrService — server-side proxy to https://api.attestr.com.
//
// The Attestr partner token is sensitive (it's tied to our billing
// quota) so it never leaves the backend. The browser hits
// /api/attestr/* which calls out with the token stored in admin
// settings (`attestrApiKey`).

const adminSettings = require('./adminSettingsService');

const BASE_URL = 'https://api.attestr.com';

async function getKey() {
  const key = await adminSettings.getString('attestrApiKey');
  if (!key) {
    throw {
      statusCode: 503,
      message:
        'Attestr is not configured. Add an API token under Admin > Platform settings > Attestr.',
    };
  }
  return key;
}

async function callAttestr(path, { method = 'POST', body } = {}) {
  const key = await getKey();
  const url = `${BASE_URL}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw {
      statusCode: 502,
      message:
        'Unable to reach the Attestr API. The upstream service may be down — please try again in a few minutes.',
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
    // Attestr error codes per docs: 4001 / 4005 / 4016 / 4031 / 4035 /
    // 4039 / 4291-4. Map the noisier ones to friendly UI strings.
    const code =
      payload && (payload.code || payload.errorCode || payload.error);
    const upstreamMsg =
      (payload && (payload.message || payload.error)) ||
      `Attestr API error (HTTP ${res.status}).`;
    const friendly =
      code === 4001
        ? upstreamMsg ||
          'The request is missing required parameters or has invalid values.'
        : code === 4005
          ? 'Attestr account balance is low. Top up to continue.'
          : code === 4016 || code === 4031
            ? 'Attestr token is invalid or unauthorized. Update it in Admin > Platform settings.'
            : code === 4035
              ? 'This Attestr service is not enabled for the account.'
              : code === 4039
                ? 'Attestr blocked the request: server IP is not whitelisted.'
                : String(code).startsWith('429')
                  ? 'Attestr rate limit hit. Please slow down and retry.'
                  : upstreamMsg;
    throw {
      statusCode: res.status,
      message: friendly,
      upstreamCode: code,
    };
  }

  return payload;
}

const COURT_TYPES = new Set([
  'DC',
  'HC',
  'SC',
  'CC',
  'NCLT',
  'NCLAT',
  'GSTAT',
  'DRT',
  'DRAT',
]);

/**
 * Unified case details. Validates the inputs, drops empty strings, and
 * forwards the rest to Attestr v2. Returns the upstream payload as-is.
 */
async function unifiedCaseDetails(body = {}) {
  const courtType = String(body.courtType || '').trim().toUpperCase();
  if (!courtType) {
    throw { statusCode: 400, message: 'courtType is required.' };
  }
  if (!COURT_TYPES.has(courtType)) {
    throw {
      statusCode: 400,
      message: `Unsupported courtType "${courtType}". Allowed: ${[...COURT_TYPES].join(', ')}.`,
    };
  }

  const pick = (key) => {
    const v = body[key];
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s ? s : undefined;
  };

  const payload = {
    courtType,
    cnr: pick('cnr'),
    establishmentCode: pick('establishmentCode'),
    caseType: pick('caseType'),
    registrationNumber: pick('registrationNumber'),
    diaryNumber: pick('diaryNumber'),
    filingNumber: pick('filingNumber'),
  };

  // At least one of these identifiers is needed to look anything up.
  const hasAnyId =
    payload.cnr ||
    payload.registrationNumber ||
    payload.diaryNumber ||
    payload.filingNumber;
  if (!hasAnyId) {
    throw {
      statusCode: 400,
      message:
        'Provide at least one of: CNR, registration number, diary number, or filing number.',
    };
  }

  // Strip undefined keys so the request body stays clean.
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }

  const res = await callAttestr(
    '/api/v2/public/ecourtx/case-details/basic',
    { method: 'POST', body: payload }
  );
  return res;
}

module.exports = { unifiedCaseDetails, COURT_TYPES: [...COURT_TYPES] };
