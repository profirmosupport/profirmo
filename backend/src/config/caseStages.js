// caseStages — canonical stage list used across every case type
// (litigation + tax + advisory). Replaces the earlier per-pipeline
// model (civil_suit / criminal_complaint / writ_petition / matrimonial
// / tax_appeal_cit_a / gst_appeal) because operators preferred a
// single shared lifecycle they could glance at across the firm.
//
// The pipelines table in seeds/compliance-rules.json is still kept
// for reference but is no longer driven from here.

const COMMON_STAGES = [
  {
    key: 'intake',
    label: 'Intake',
    description: 'New matter, gathering basics from the client.',
  },
  {
    key: 'preparation',
    label: 'Preparation',
    description: 'Drafting, evidence collection, computation, planning.',
  },
  {
    key: 'filed',
    label: 'Filed / Submitted',
    description: 'Pleading filed in court or return filed with authority.',
  },
  {
    key: 'awaiting_response',
    label: 'Awaiting Response',
    description: 'Waiting on counter-party, court, or department.',
  },
  {
    key: 'hearing',
    label: 'Hearing / Review',
    description: 'Active hearings or under departmental review.',
  },
  {
    key: 'closing',
    label: 'Closing',
    description: 'Final paperwork, judgment compliance, billing wrap-up.',
  },
  {
    key: 'closed',
    label: 'Closed',
    description: 'Matter complete, archived.',
  },
];

const STAGE_BY_KEY = new Map(COMMON_STAGES.map((s) => [s.key, s]));

function listStages() {
  return COMMON_STAGES;
}

function getStage(key) {
  if (!key) return null;
  return STAGE_BY_KEY.get(String(key)) || null;
}

/**
 * Validate a stage value — returns the canonical key if known, null
 * otherwise. Callers can write the result straight to the DB.
 */
function normalize(stage) {
  if (!stage) return null;
  return STAGE_BY_KEY.has(String(stage)) ? String(stage) : null;
}

function labelFor(stage) {
  const s = getStage(stage);
  return s ? s.label : stage || '';
}

module.exports = { listStages, getStage, normalize, labelFor, COMMON_STAGES };
