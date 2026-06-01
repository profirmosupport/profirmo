'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Plus,
  RefreshCw,
  Eye,
  MoreVertical,
  Users,
  CircleDashed,
  ExternalLink,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import Avatar from '@/components/common/Avatar';
import RowMenu from '@/components/common/RowMenu';
import AddCaseModal from '@/components/cases/AddCaseModal';
import QuotaBanner from '@/components/common/QuotaBanner';
import caseService from '@/services/caseService';
import { getLawFirm } from '@/services/profileService';
import { getMyUsage } from '@/services/subscriptionService';
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

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
];

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

function CaseActionsMenu({ row, onView, onReassign, onChangeStatus }) {
  // Nested "Change status" submenu state. The parent RowMenu handles
  // open/close, click-outside and Esc; we just track which inner row is
  // expanded.
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <RowMenu
      onOpen={() => setStatusOpen(false)}
      trigger={
        <button
          type="button"
          aria-label="Open case actions menu"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-amber-300 hover:bg-slate-50"
        >
          <MoreVertical size={16} />
        </button>
      }
    >
      <button
        type="button"
        role="menuitem"
        onClick={onView}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
      >
        <Eye size={14} /> View
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onReassign}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
      >
        <Users size={14} /> Reassign
      </button>
      <div className="border-t border-slate-100">
        <button
          type="button"
          onClick={(e) => {
            // Stop the click from bubbling — RowMenu's auto-close would
            // otherwise dismiss the whole popover.
            e.stopPropagation();
            setStatusOpen((v) => !v);
          }}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <CircleDashed size={14} /> Change status
          </span>
          <span className="text-xs text-slate-400">
            {STATUS_LABEL[row.status] || row.status || '—'}
          </span>
        </button>
        {statusOpen && (
          <div className="border-t border-slate-100 bg-slate-50">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setStatusOpen(false);
                  onChangeStatus(opt.value);
                }}
                disabled={row.status === opt.value}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <span>{opt.label}</span>
                {row.status === opt.value && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-600">
                    Current
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </RowMenu>
  );
}

export default function FirmCasesPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [firmId, setFirmId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  // Firm-scoped plan quota. `usage.firmCases` is populated when the
  // caller owns the firm; otherwise the banner is hidden.
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

  const [reassignTarget, setReassignTarget] = useState(null);
  const [reassignError, setReassignError] = useState('');

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await caseService.getFirmCases();
      setFirmId(res && res.firmId ? res.firmId : null);
      setItems(Array.isArray(res && res.items) ? res.items : []);
    } catch (err) {
      setError(err.message || 'Failed to load cases.');
      setItems([]);
      setFirmId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Load the firm's member list eagerly so AddCaseModal can render the
  // assignee picker the very first time the user opens it (the picker is
  // gated on `firmMembers.length > 0`).
  const ensureMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const data = await getLawFirm();
      const list = data && Array.isArray(data.members) ? data.members : [];
      setMembers(list);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    ensureMembers();
  }, [ensureMembers]);

  function openReassign(c) {
    setReassignTarget(c);
    setReassignError('');
  }

  function closeReassign() {
    if (reassignSaving) return;
    setReassignTarget(null);
    setReassignError('');
  }

  // Selected ids for the multi-select reassign panel.
  const [reassignIds, setReassignIds] = useState([]);
  const [reassignSaving, setReassignSaving] = useState(false);

  // Whenever a different case is targeted, prefill the selection with its
  // current assignees so the modal opens in the "current state".
  useEffect(() => {
    if (!reassignTarget) {
      setReassignIds([]);
      return;
    }
    const initial =
      Array.isArray(reassignTarget.professionalIds) &&
      reassignTarget.professionalIds.length > 0
        ? reassignTarget.professionalIds
        : reassignTarget.professionalId
          ? [reassignTarget.professionalId]
          : [];
    setReassignIds([...new Set(initial.filter(Boolean))]);
  }, [reassignTarget]);

  function publicIdOf(member) {
    return (
      member.publicId ||
      (member.professional && member.professional.publicId) ||
      member.professionalId ||
      member.professionalDetailId ||
      null
    );
  }

  function toggleReassign(pid) {
    if (!pid) return;
    setReassignIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]
    );
  }

  async function saveReassign() {
    if (!reassignTarget) return;
    // A case must always have at least one assigned professional — reject
    // an empty selection BEFORE hitting the API.
    const ids = (reassignIds || []).filter(Boolean);
    if (ids.length === 0) {
      setReassignError(
        'At least one professional must be assigned to the case.'
      );
      return;
    }
    setReassignSaving(true);
    setReassignError('');
    try {
      await caseService.update(reassignTarget.id, {
        professionalIds: ids,
      });
      setReassignTarget(null);
      // Per spec: full page reload after a successful reassign so every
      // quota count + cached state on the page reflects the new
      // categorisation (single -> firm or firm -> single).
      if (typeof window !== 'undefined') {
        window.location.reload();
        return;
      }
      await load();
      await loadUsage();
    } catch (err) {
      // Surface plan-limit errors with the upgrade-CTA banner shape so the
      // modal explains why the reassign was rejected.
      if (err && err.payload && err.payload.code === 'PLAN_LIMIT_REACHED') {
        setReassignError(err.payload.message || err.message);
      } else {
        setReassignError(err.message || 'Could not reassign case.');
      }
    } finally {
      setReassignSaving(false);
    }
  }

  async function changeStatus(row, status) {
    if (!row || row.status === status) return;
    setBusyId(row.id);
    setActionError('');
    try {
      await caseService.update(row.id, { status });
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not update status.');
    } finally {
      setBusyId(null);
    }
  }

  // Firm-scoped quota — only populated when the caller owns the firm.
  // When usage.firmCases is missing the banner stays hidden and the
  // button only respects the legacy !firmId disable.
  const firmCaseRemaining =
    usage && usage.firmCases && usage.firmCases.remaining;
  const firmCaseExhausted = firmCaseRemaining === 0;

  return (
    <DashboardLayout role={ROLES.FIRM_ADMIN} title="Cases" subtitle="Firm-wide case list">
      <div className="space-y-6">
        {usage && usage.firmCases ? (
          <QuotaBanner
            label="Firm cases"
            used={usage.firmCases.used}
            limit={usage.firmCases.limit}
            remaining={usage.firmCases.remaining}
            unlimited={usage.firmCases.unlimited}
            planName={usage.firmCases.planName || usage.planName}
            helpText="A firm case is any case with two or more assigned professionals from this firm."
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
                  disabled={!firmId || firmCaseExhausted}
                  title={
                    firmCaseExhausted
                      ? 'Firm case limit reached — upgrade your plan to add more.'
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
                : `${items.length} case${items.length === 1 ? '' : 's'}`}
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
              <Button
                size="sm"
                onClick={() => setAddOpen(true)}
                disabled={!firmId}
              >
                <Plus size={15} />
                New case
              </Button>
            </div>
          </div>
        )}

        {actionError && (
          <Card>
            <p className="text-sm text-red-600">{actionError}</p>
          </Card>
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
        ) : !firmId ? (
          <EmptyState
            icon={<Briefcase size={24} />}
            title="Your firm has not been set up"
            description="Create or join a firm to start tracking cases."
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={24} />}
            title="No cases yet"
            description="Cases created for your firm will appear here."
            action={
              <Button
                size="sm"
                onClick={() => setAddOpen(true)}
                disabled={firmCaseExhausted}
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
                  <th className="px-4 py-3 font-semibold">Assignee</th>
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
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {c.title || '—'}
                      </p>
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
                    <td className="px-4 py-3 text-slate-600">
                      {(() => {
                        // Prefer the decorated `professionals` array; fall
                        // back to the legacy single `professionalId`.
                        const list =
                          Array.isArray(c.professionals) && c.professionals.length > 0
                            ? c.professionals
                            : c.professional
                              ? [c.professional]
                              : c.professionalId
                                ? [{ publicId: c.professionalId, name: c.professionalId }]
                                : [];
                        if (list.length === 0) {
                          return (
                            <span className="text-slate-400">Unassigned</span>
                          );
                        }
                        return (
                          <div className="flex flex-wrap items-center gap-1">
                            {list.map((p) => (
                              <a
                                key={p.publicId}
                                href={`/professionals/${p.publicId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                {p.name || p.publicId}
                                <ExternalLink size={10} />
                              </a>
                            ))}
                          </div>
                        );
                      })()}
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
                      {busyId === c.id && (
                        <span className="ml-2 text-xs text-slate-400">
                          Saving…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.nextHearingDate ? formatDate(c.nextHearingDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <CaseActionsMenu
                          row={c}
                          onView={() =>
                            router.push(`/dashboard/firm/cases/${c.id}`)
                          }
                          onReassign={() => openReassign(c)}
                          onChangeStatus={(s) => changeStatus(c, s)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
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
        defaults={firmId ? { firmId } : undefined}
        firmMembers={members}
      />

      <Modal
        open={!!reassignTarget}
        onClose={closeReassign}
        title={
          reassignTarget
            ? `Reassign "${reassignTarget.title || 'case'}"`
            : 'Reassign case'
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeReassign}
              disabled={reassignSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={saveReassign}
              disabled={
                reassignSaving ||
                (reassignIds || []).filter(Boolean).length === 0
              }
              title={
                (reassignIds || []).filter(Boolean).length === 0
                  ? 'At least one professional must be assigned.'
                  : undefined
              }
            >
              {reassignSaving ? 'Saving…' : 'Save assignments'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Toggle any firm members to assign or remove from this case.
            Selecting nothing un-assigns the case.
          </p>
          {membersLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={<Users size={20} />}
              title="No members"
              description="Your firm has no members to assign to yet."
            />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {members.map((m) => {
                const pid = publicIdOf(m);
                const checked = pid ? reassignIds.includes(pid) : false;
                return (
                  <li
                    key={m.id}
                    className={`flex items-center gap-3 px-3 py-3 transition-colors ${
                      checked ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      checked={checked}
                      onChange={() => toggleReassign(pid)}
                      disabled={!pid || reassignSaving}
                    />
                    <Avatar src={m.profilePhoto} name={m.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {m.name || '—'}
                      </p>
                      {m.email && (
                        <p className="truncate text-xs text-slate-500">
                          {m.email}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                      {m.role}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {reassignError && (
            <p className="text-xs text-red-600">{reassignError}</p>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
