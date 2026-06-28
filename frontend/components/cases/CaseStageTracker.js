'use client';

// CaseStageTracker — horizontal stepper showing where this case sits
// in its lifecycle (intake → preparation → filed → awaiting response →
// hearing → closing → closed). One canonical list across litigation,
// tax and advisory matters — same stages drive the Kanban board on
// /dashboard/professional/cases.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, GitBranch } from 'lucide-react';
import Card from '@/components/common/Card';
import caseService from '@/services/caseService';

export default function CaseStageTracker({ caseRow, onUpdated }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Optimistic stage state so the stepper feels instant during the
  // PATCH round-trip.
  const [stage, setStage] = useState(caseRow ? caseRow.stage || '' : '');

  useEffect(() => {
    setStage(caseRow ? caseRow.stage || '' : '');
  }, [caseRow]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await caseService.listStages();
      setStages(rows);
    } catch (err) {
      setError(err.message || 'Could not load stage list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stageIndex = useMemo(() => {
    if (!stage) return -1;
    return stages.findIndex((s) => s.key === stage);
  }, [stages, stage]);

  async function persist(nextStage) {
    setSaving(true);
    setError('');
    try {
      const updated = await caseService.setStage(caseRow.id, { stage: nextStage });
      if (typeof onUpdated === 'function') onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Could not update stage.');
      // Roll back optimistic state on failure.
      setStage(caseRow.stage || '');
    } finally {
      setSaving(false);
    }
  }

  function handleStageClick(s) {
    if (s.key === stage) return;
    setStage(s.key);
    persist(s.key);
  }

  if (loading) {
    return (
      <Card>
        <p className="text-xs text-slate-400">Loading stage…</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <GitBranch size={14} />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Case stage</h3>
          <p className="text-xs text-slate-500">
            {stage
              ? `Currently in ${stages.find((s) => s.key === stage)?.label || stage}.`
              : 'Click a stage to set where this case stands.'}
          </p>
        </div>
        {saving && (
          <span className="text-[11px] text-slate-400">Saving…</span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <ol className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
        {stages.map((s, i) => {
          const isPast = stageIndex >= 0 && i < stageIndex;
          const isCurrent = i === stageIndex;
          return (
            <li key={s.key} className="flex items-center">
              <button
                type="button"
                onClick={() => handleStageClick(s)}
                disabled={saving}
                title={s.description || s.label}
                className={[
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition',
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isPast
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                ].join(' ')}
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
              {i < stages.length - 1 && (
                <ChevronRight size={12} className="mx-0.5 text-slate-300" />
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
