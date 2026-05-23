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
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import Avatar from '@/components/common/Avatar';
import AddCaseModal from '@/components/cases/AddCaseModal';
import caseService from '@/services/caseService';
import { getLawFirm } from '@/services/profileService';
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
  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setStatusOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        setStatusOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open case actions menu"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-amber-300 hover:bg-slate-50"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onView();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <Eye size={14} /> View
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReassign();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <Users size={14} /> Reassign
          </button>
          <div className="border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStatusOpen((v) => !v)}
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
                      setOpen(false);
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
        </div>
      )}
    </div>
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

  const [reassignTarget, setReassignTarget] = useState(null);
  const [reassignSubmittingId, setReassignSubmittingId] = useState(null);
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

  async function ensureMembers() {
    if (members.length > 0 || membersLoading) return;
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
  }

  function openReassign(c) {
    setReassignTarget(c);
    setReassignError('');
    ensureMembers();
  }

  function closeReassign() {
    if (reassignSubmittingId) return;
    setReassignTarget(null);
    setReassignError('');
  }

  async function chooseMember(member) {
    if (!reassignTarget) return;
    const professionalId =
      member.professionalId || member.professionalDetailId || member.id;
    setReassignSubmittingId(member.id);
    setReassignError('');
    try {
      await caseService.update(reassignTarget.id, { professionalId });
      setReassignTarget(null);
      await load();
    } catch (err) {
      setReassignError(err.message || 'Could not reassign case.');
    } finally {
      setReassignSubmittingId(null);
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

  return (
    <DashboardLayout role={ROLES.FIRM_ADMIN} title="Cases" subtitle="Firm-wide case list">
      <div className="space-y-6">
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
              <Button size="sm" onClick={() => setAddOpen(true)}>
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
                      {c.professionalId || '—'}
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
        }}
        defaults={firmId ? { firmId } : undefined}
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
          <Button
            variant="outline"
            size="sm"
            onClick={closeReassign}
            disabled={!!reassignSubmittingId}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Pick a firm member to assign this case to.
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
                const busy = reassignSubmittingId === m.id;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-slate-50"
                  >
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
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => chooseMember(m)}
                      disabled={!!reassignSubmittingId}
                    >
                      {busy ? 'Assigning…' : 'Assign'}
                    </Button>
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
