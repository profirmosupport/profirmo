'use client';

// CaseStageTracker — pipeline picker + horizontal stepper for a case.
//
// First-time use: pro picks a pipeline (civil_suit, criminal_complaint,
// writ_petition, matrimonial, tax_appeal_cit_a, gst_appeal) and the
// stepper appears with the first stage marked current. Subsequent
// clicks advance to any stage.
//
// Source of truth for pipelines is backend/seeds/compliance-rules.json,
// served via GET /api/cases/pipelines.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, GitBranch } from 'lucide-react';
import Card from '@/components/common/Card';
import caseService from '@/services/caseService';

export default function CaseStageTracker({ caseRow, onUpdated }) {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Local optimistic view of the case stage — keeps the stepper
  // responsive while the PATCH is in-flight.
  const [stageType, setStageType] = useState(caseRow ? caseRow.stageType || '' : '');
  const [stage, setStage] = useState(caseRow ? caseRow.stage || '' : '');

  useEffect(() => {
    setStageType(caseRow ? caseRow.stageType || '' : '');
    setStage(caseRow ? caseRow.stage || '' : '');
  }, [caseRow]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await caseService.listStagePipelines();
      setPipelines(rows);
    } catch (err) {
      setError(err.message || 'Could not load stage pipelines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.key === stageType) || null,
    [pipelines, stageType]
  );
  const stageIndex = useMemo(() => {
    if (!activePipeline || !stage) return -1;
    return activePipeline.stages.findIndex((s) => s.key === stage);
  }, [activePipeline, stage]);

  async function persist(nextStageType, nextStage) {
    setSaving(true);
    setError('');
    try {
      const updated = await caseService.setStage(caseRow.id, {
        stageType: nextStageType,
        stage: nextStage,
      });
      if (typeof onUpdated === 'function') onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Could not update stage.');
      // Roll back optimistic state on failure.
      setStageType(caseRow.stageType || '');
      setStage(caseRow.stage || '');
    } finally {
      setSaving(false);
    }
  }

  function handlePipelineChange(e) {
    const next = e.target.value;
    setStageType(next);
    // Optimistically set to first stage of the new pipeline.
    const pipe = pipelines.find((p) => p.key === next);
    const firstStage = pipe && pipe.stages[0] ? pipe.stages[0].key : '';
    setStage(firstStage);
    persist(next || null, firstStage || null);
  }

  function handleStageClick(s) {
    if (s.key === stage) return;
    setStage(s.key);
    persist(stageType, s.key);
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <GitBranch size={14} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Case stage
            </h3>
            <p className="text-xs text-slate-500">
              {activePipeline
                ? `Pipeline: ${activePipeline.label}`
                : 'Pick a pipeline to start tracking where this case is.'}
            </p>
          </div>
        </div>
        <div>
          <label className="sr-only" htmlFor="case-pipeline">
            Pipeline
          </label>
          <select
            id="case-pipeline"
            value={stageType}
            onChange={handlePipelineChange}
            disabled={loading || saving}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
          >
            <option value="">— No pipeline —</option>
            {pipelines.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {activePipeline ? (
        <ol className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2">
          {activePipeline.stages.map((s, i) => {
            const isPast = stageIndex >= 0 && i < stageIndex;
            const isCurrent = i === stageIndex;
            return (
              <li key={s.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleStageClick(s)}
                  disabled={saving}
                  className={[
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition',
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isPast
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  ].join(' ')}
                  title={`${isPast ? 'Completed' : isCurrent ? 'Current' : 'Upcoming'} — click to set`}
                >
                  {isPast ? (
                    <Check size={11} />
                  ) : (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/30 text-[9px] font-semibold">
                      {i + 1}
                    </span>
                  )}
                  <span>{s.label}</span>
                </button>
                {i < activePipeline.stages.length - 1 && (
                  <ChevronRight size={12} className="mx-0.5 text-slate-300" />
                )}
              </li>
            );
          })}
        </ol>
      ) : !loading && pipelines.length > 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-500">
          Pick a pipeline above to begin tracking the case lifecycle on
          this matter.
        </p>
      ) : null}

      {saving && (
        <p className="mt-2 text-[11px] text-slate-400">Saving…</p>
      )}
    </Card>
  );
}
