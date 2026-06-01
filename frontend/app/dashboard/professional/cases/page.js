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
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
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
                    <td className="px-4 py-3 text-slate-600">
                      {c.category || '—'}
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
