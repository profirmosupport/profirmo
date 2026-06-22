'use client';

import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Plus, RefreshCw, Eye, Building2 } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import AddCaseModal from '@/components/cases/AddCaseModal';
import QuotaBanner from '@/components/common/QuotaBanner';
import caseService from '@/services/caseService';
import { getMyUsage } from '@/services/subscriptionService';
import { useAuth } from '@/components/AuthProvider';
import firmJoinService from '@/services/firmJoinService';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';

const PRIORITY_VARIANT = {
  low: 'gray',
  medium: 'gray',
  high: 'amber',
  urgent: 'red',
};

const STATUS_VARIANT = {
  open: 'blue',
  'in-progress': 'amber',
  closed: 'green',
};

const STATUS_LABEL = {
  open: 'Open',
  'in-progress': 'In progress',
  closed: 'Closed',
};

// Local mirror of backend/src/config/caseStages.js so the table /
// Kanban don't need an extra API round-trip to render labels. Keep in
// sync if the canonical list changes — there's also /api/cases/stages
// for the case-detail stepper which fetches dynamically.
const STAGE_ORDER = [
  'intake',
  'preparation',
  'filed',
  'awaiting_response',
  'hearing',
  'closing',
  'closed',
];

const STAGE_LABEL = {
  intake: 'Intake',
  preparation: 'Preparation',
  filed: 'Filed',
  awaiting_response: 'Awaiting Response',
  hearing: 'Hearing',
  closing: 'Closing',
  closed: 'Closed',
};

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-16 w-full animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function ProfessionalCasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [firmIdForCreate, setFirmIdForCreate] = useState(null);
  // View mode — 'table' (default, dense scannable) or 'kanban'
  // (columns grouped by stage, drag-and-glance for pipeline reviews).
  const [viewMode, setViewMode] = useState('table');
  // Plan quota snapshot — drives the QuotaBanner + button-disable below.
  const [usage, setUsage] = useState(null);

  const loadUsage = useCallback(async () => {
    try {
      const u = await getMyUsage();
      setUsage(u);
    } catch {
      setUsage(null);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  // If the caller belongs to a firm, surface its id so cases created from
  // the professional dashboard are tagged with the firm and surface in the
  // firm's cases list.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const membership = await firmJoinService.getMyMembership();
        if (!active) return;
        setFirmIdForCreate(
          (membership && membership.firm && (membership.firm.legacyFirmId || membership.firm.id)) ||
            null
        );
      } catch {
        if (active) setFirmIdForCreate(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await caseService.getMyCases();
      setCases(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || 'Failed to load cases.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Cases"
      subtitle="Matters assigned to you"
    >
      <div className="space-y-6">
        {/* Plan quota + page actions live on the same card. When the user
            has no subscription on file (usage===null) we still want the
            Refresh + New case toolbar to exist, so we render a minimal
            row underneath. */}
        {usage && usage.cases ? (
          <QuotaBanner
            label="Cases"
            used={usage.cases.used}
            limit={usage.cases.limit}
            remaining={usage.cases.remaining}
            unlimited={usage.cases.unlimited}
            planName={usage.planName}
            helpText="A case with two or more assigned professionals counts toward your firm's case limit instead."
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshCw size={15} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  disabled={usage.cases.remaining === 0}
                  title={
                    usage.cases.remaining === 0
                      ? 'Case limit reached — upgrade your plan to add more.'
                      : undefined
                  }
                >
                  <Plus size={15} />
                  New case
                </Button>
              </>
            }
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {loading
                ? 'Loading cases…'
                : `${cases.length} case${cases.length === 1 ? '' : 's'}`}
            </p>
            <div className="flex items-center gap-2">
              {/* View mode toggle — Table (default, dense) vs Kanban
                  (columns by stage). Sticky in component state only;
                  not persisted yet — easy to upgrade to a localStorage
                  pref later. */}
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === 'table'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === 'kanban'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Kanban
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw size={15} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus size={15} />
                New case
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">{error}</p>
              <Button size="sm" onClick={load}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          </Card>
        ) : cases.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={24} />}
            title="No cases yet"
            description="Cases assigned to you will appear here."
            action={
              <Button
                size="sm"
                onClick={() => setAddOpen(true)}
                disabled={usage && usage.cases && usage.cases.remaining === 0}
              >
                <Plus size={15} />
                New case
              </Button>
            }
          />
        ) : viewMode === 'kanban' ? (
          <CasesKanban cases={cases} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  {/* Category column dropped — replaced by Stage so
                      the table communicates *where the case is*
                      instead of *what type of work it is*. */}
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Next hearing</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((c) => {
                  // A case with 2+ assignees is a firm case per the
                  // current spec — surface a small badge inline with the
                  // title so the pro can tell at a glance which of their
                  // cases roll up to the firm's quota instead of theirs.
                  const assignees = Array.isArray(c.professionalIds)
                    ? c.professionalIds.filter(Boolean)
                    : [];
                  const isFirmCase = assignees.length >= 2;
                  return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-800">
                          {c.title || '—'}
                        </p>
                        {isFirmCase && (
                          <span
                            title={`Firm case — ${assignees.length} professionals assigned`}
                            className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700"
                          >
                            <Building2 size={10} />
                            Firm case
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.stage ? (
                        <Badge variant="violet">
                          {STAGE_LABEL[c.stage] || c.stage}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">— Not set —</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.client ? (
                        <div>
                          <p className="font-medium text-slate-800">
                            {c.client.name}
                          </p>
                          {c.client.phone && (
                            <p className="text-xs text-slate-400">
                              {c.client.phone}
                            </p>
                          )}
                        </div>
                      ) : (
                        c.clientId || '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PRIORITY_VARIANT[c.priority] || 'gray'}>
                        {c.priority || 'medium'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[c.status] || 'gray'}>
                        {STATUS_LABEL[c.status] || c.status || 'Open'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.nextHearingDate ? formatDate(c.nextHearingDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Button
                          href={`/dashboard/professional/cases/${c.id}`}
                          variant="outline"
                          size="sm"
                        >
                          <Eye size={14} />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddCaseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          load();
          loadUsage();
        }}
        defaults={{
          // Auto-assign the creator (so cases land on their dashboard).
          professionalIds:
            user && user.linkedId ? [user.linkedId] : [],
          // Tag the case with the creator's firm (if any) so it surfaces
          // in the firm cases list.
          firmId: firmIdForCreate || undefined,
        }}
      />
    </DashboardLayout>
  );
}

/**
 * CasesKanban — horizontal-scroll board with one column per canonical
 * stage. Cases without a stage drop into an "Unassigned" column at the
 * front so they're not lost. Read-only for v1 — no drag-and-drop yet;
 * the user updates stage from the case detail page.
 */
function CasesKanban({ cases }) {
  const columns = [{ key: 'unassigned', label: 'Unassigned' }];
  for (const k of STAGE_ORDER) {
    columns.push({ key: k, label: STAGE_LABEL[k] });
  }

  const byStage = new Map();
  for (const c of cases) {
    const key = c.stage && STAGE_LABEL[c.stage] ? c.stage : 'unassigned';
    if (!byStage.has(key)) byStage.set(key, []);
    byStage.get(key).push(c);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {columns.map((col) => {
        const items = byStage.get(col.key) || [];
        return (
          <div
            key={col.key}
            className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {col.label}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {items.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {items.length === 0 ? (
                <p className="px-1 py-4 text-center text-[11px] text-slate-400">
                  No cases here
                </p>
              ) : (
                items.map((c) => (
                  <a
                    key={c.id}
                    href={`/dashboard/professional/cases/${c.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-sm transition hover:border-amber-300 hover:shadow"
                  >
                    <p className="line-clamp-2 font-medium text-slate-800">
                      {c.title || 'Untitled case'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {c.client && c.client.name
                        ? c.client.name
                        : c.clientId || '—'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge variant={PRIORITY_VARIANT[c.priority] || 'gray'}>
                        {c.priority || 'medium'}
                      </Badge>
                      {c.nextHearingDate && (
                        <span className="text-[10px] text-slate-500">
                          Hearing {formatDate(c.nextHearingDate)}
                        </span>
                      )}
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
