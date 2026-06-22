// caseStages — pipeline definitions for case lifecycle stage tracking.
//
// Source of truth lives in seeds/compliance-rules.json under the
// `courtStages` key. That file is marked DRAFT — pending CA + litigator
// sign-off. This module loads it lazily so the seed file stays the
// single canonical place to edit pipelines; nothing downstream has to
// know whether the data came from JSON or a hard-coded list.
//
// Each pipeline:
//   { key, label, stages: [{ key, label }] }
//
// stageType on a Case stores the pipeline key (e.g. 'civil_suit');
// stage stores the current stage's key (e.g. 'evidence_plaintiff'). A
// case can be re-assigned to a different pipeline (rare — usually a
// data-entry mistake) by patching stageType, which resets stage to the
// first entry.

const path = require('path');
const fs = require('fs');

let cache = null;

function load() {
  if (cache) return cache;
  const file = path.join(__dirname, '..', '..', 'seeds', 'compliance-rules.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const courtStages = raw.courtStages || {};
  // Normalise into an array of pipelines for easier iteration.
  const pipelines = Object.entries(courtStages).map(([key, def]) => ({
    key,
    label: def.label || key,
    stages: Array.isArray(def.stages) ? def.stages : [],
  }));
  const byKey = new Map(pipelines.map((p) => [p.key, p]));
  cache = { pipelines, byKey };
  return cache;
}

/** Every known pipeline (for the UI picker). */
function listPipelines() {
  return load().pipelines;
}

/** Resolve a pipeline by key, or null if unknown. */
function getPipeline(key) {
  if (!key) return null;
  return load().byKey.get(String(key)) || null;
}

/**
 * Validate that (stageType, stage) is a coherent pair. Returns the
 * canonical pair (trims unknown values to null) so callers can write
 * the result straight to the DB without re-validating.
 */
function normalize(stageType, stage) {
  const pipe = getPipeline(stageType);
  if (!pipe) return { stageType: null, stage: null };
  if (!stage) {
    // Default to first stage of the chosen pipeline.
    const first = pipe.stages[0];
    return { stageType: pipe.key, stage: first ? first.key : null };
  }
  const known = pipe.stages.find((s) => s.key === String(stage));
  return {
    stageType: pipe.key,
    stage: known ? known.key : pipe.stages[0] ? pipe.stages[0].key : null,
  };
}

/**
 * Resolve a human-readable label for a stage given its pipeline. Falls
 * back to the raw key when unknown.
 */
function labelFor(stageType, stage) {
  const pipe = getPipeline(stageType);
  if (!pipe) return stage || '';
  const found = pipe.stages.find((s) => s.key === stage);
  return found ? found.label : stage || '';
}

module.exports = { listPipelines, getPipeline, normalize, labelFor };
