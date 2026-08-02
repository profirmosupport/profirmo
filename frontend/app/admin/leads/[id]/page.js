'use client';

// Admin — Lead detail.
// Shows contact info, status, assignment, the chronological activity
// timeline and a free-text note composer. Admin can edit the lead inline,
// change status / assignee, and promote a qualified lead to an
// Opportunity. After conversion the page redirects to the new opportunity
// detail page.

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Sparkles,
  MessageSquare,
  Pencil,
  TrendingUp,
  Briefcase,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import {
  adminGetLead,
  adminUpdateLead,
  adminListLeadActivities,
  adminAddLeadNote,
  adminConvertLead,
  LEAD_STATUSES,
} from '@/services/leadService';
import { listUsers } from '@/services/adminService';

function statusVariant(s) {
  switch (s) {
    case 'New':
      return 'blue';
    case 'Contacted':
      return 'amber';
    case 'Qualified':
      return 'green';
    case 'Opportunity':
      return 'violet';
    case 'Converted':
      return 'emerald';
    default:
      return 'gray';
  }
}

export default function AdminLeadDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [noteText, setNoteText] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const isAdmin = user && user.role === ROLES.PLATFORM_ADMIN;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [l, acts] = await Promise.all([
        adminGetLead(id),
        adminListLeadActivities(id),
      ]);
      setLead(l);
      setActivities(Array.isArray(acts) ? acts : []);
    } catch (err) {
      setError(err.message || 'Failed to load the lead.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) load();
  }, [authLoading, isAuthenticated, isAdmin, load]);

  useEffect(() => {
    if (!isAdmin) return;
    listUsers({ role: 'platform_admin', limit: 100 })
      .then(({ data }) => setAssignees(Array.isArray(data) ? data : []))
      .catch(() => setAssignees([]));
  }, [isAdmin]);

  function startEdit() {
    setEditError('');
    setEditForm({
      fullName: lead.fullName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || '',
      status: lead.status || 'New',
      notes: lead.notes || '',
      assignedToUserId: lead.assignedToUserId || '',
    });
    setEditing(true);
  }
  function cancelEdit() {
    if (saving) return;
    setEditing(false);
    setEditForm(null);
    setEditError('');
  }

  async function saveEdit(e) {
    if (e) e.preventDefault();
    if (saving) return;
    setSaving(true);
    setEditError('');
    try {
      await adminUpdateLead(id, {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone,
        source: editForm.source,
        status: editForm.status,
        notes: editForm.notes || null,
        assignedToUserId: editForm.assignedToUserId || null,
      });
      setEditing(false);
      setEditForm(null);
      await load();
    } catch (err) {
      setEditError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function addNote(e) {
    if (e) e.preventDefault();
    const message = noteText.trim();
    if (!message || noteSubmitting) return;
    setNoteSubmitting(true);
    try {
      await adminAddLeadNote(id, message);
      setNoteText('');
      await load();
    } catch {
      /* swallow — keep the text in the box */
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function changeStatus(next) {
    if (!lead || lead.status === next) return;
    try {
      await adminUpdateLead(id, { status: next });
      await load();
    } catch {
      /* no-op */
    }
  }

  async function changeAssignee(next) {
    if (!lead || (lead.assignedToUserId || '') === (next || '')) return;
    try {
      await adminUpdateLead(id, { assignedToUserId: next || null });
      await load();
    } catch {
      /* no-op */
    }
  }

  async function confirmConvert() {
    if (converting) return;
    setConverting(true);
    try {
      const opp = await adminConvertLead(id);
      setConvertOpen(false);
      router.push(`/admin/opportunities/${opp.id}`);
    } catch {
      setConverting(false);
    }
  }

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Lead" />;
  }
  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Lead">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account."
          action={
            <Button href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </DashboardLayout>
    );
  }
  if (loading) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Lead">
        <div className="h-40 w-full animate-pulse rounded-xl bg-slate-100" />
      </DashboardLayout>
    );
  }
  if (error || !lead) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Lead">
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={22} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {error || 'Lead not found.'}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" href="/admin/leads">
                <ArrowLeft size={15} />
                Back
              </Button>
              <Button size="sm" onClick={load}>
                <RefreshCw size={15} />
                Retry
              </Button>
            </div>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  const ASSIGNEE_OPTIONS = [
    { value: '', label: '(Unassigned)' },
    ...assignees.map((a) => ({ value: a.id, label: a.fullName || a.email })),
  ];
  const STATUS_OPTIONS_FORM = LEAD_STATUSES.map((s) => ({ value: s, label: s }));

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title={lead.fullName}
      subtitle="Lead detail and activity timeline"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button size="sm" variant="ghost" href="/admin/leads">
            <ArrowLeft size={15} />
            Back to leads
          </Button>
          <div className="flex gap-2">
            {!editing && (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil size={14} />
                Edit
              </Button>
            )}
            {lead.status !== 'Converted' && !lead.opportunityId && (
              <Button size="sm" onClick={() => setConvertOpen(true)}>
                <TrendingUp size={14} />
                Convert to opportunity
              </Button>
            )}
            {lead.opportunityId && (
              <Button
                size="sm"
                variant="outline"
                href={`/admin/opportunities/${lead.opportunityId}`}
              >
                View opportunity →
              </Button>
            )}
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {lead.fullName}
              </h2>
              <p className="text-sm text-slate-500">Source: {lead.source}</p>
            </div>
            <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
          </div>

          {!editing ? (
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-2">
                <Mail size={14} className="mt-0.5 text-slate-400" />
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="font-medium text-slate-800">{lead.email}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={14} className="mt-0.5 text-slate-400" />
                <div>
                  <dt className="text-xs text-slate-500">Phone</dt>
                  <dd className="flex items-center gap-2 font-medium text-slate-800">
                    {lead.phone}
                    {lead.phoneVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        <ShieldCheck size={11} /> OTP verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        Not verified
                      </span>
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 text-slate-400" />
                <div>
                  <dt className="text-xs text-slate-500">Source</dt>
                  <dd className="font-medium text-slate-800">{lead.source}</dd>
                </div>
              </div>
              {lead.professionalName && (
                <div className="flex items-start gap-2">
                  <Briefcase size={14} className="mt-0.5 text-slate-400" />
                  <div>
                    <dt className="text-xs text-slate-500">Professional</dt>
                    <dd className="font-medium text-slate-800">
                      {lead.professionalName}
                    </dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <CalendarDays size={14} className="mt-0.5 text-slate-400" />
                <div>
                  <dt className="text-xs text-slate-500">Created</dt>
                  <dd className="font-medium text-slate-800">
                    {formatDate(lead.createdAt)}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:col-span-2">
                <Sparkles size={14} className="mt-0.5 text-slate-400" />
                <div className="flex-1">
                  <dt className="text-xs text-slate-500">Notes</dt>
                  <dd className="whitespace-pre-line text-slate-700">
                    {lead.notes || (
                      <span className="italic text-slate-400">No notes yet.</span>
                    )}
                  </dd>
                </div>
              </div>
            </dl>
          ) : (
            <form onSubmit={saveEdit} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                label="Full name"
                name="fullName"
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, fullName: e.target.value }))
                }
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
              />
              <Input
                label="Phone"
                name="phone"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
              <Input
                label="Source"
                name="source"
                value={editForm.source}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, source: e.target.value }))
                }
              />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-100"
                />
              </div>
              {editError && (
                <p className="text-xs text-red-600 sm:col-span-2">{editError}</p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Status"
              name="status"
              value={lead.status}
              onChange={(e) => changeStatus(e.target.value)}
              options={STATUS_OPTIONS_FORM}
            />
            <Select
              label="Assigned to"
              name="assignedToUserId"
              value={lead.assignedToUserId || ''}
              onChange={(e) => changeAssignee(e.target.value)}
              options={ASSIGNEE_OPTIONS}
            />
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-900">Add a note</h3>
          </div>
          <form onSubmit={addNote} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Comment, follow-up, conversation summary…"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-100"
            />
            <Button type="submit" size="sm" disabled={noteSubmitting || !noteText.trim()}>
              {noteSubmitting ? 'Saving…' : 'Add note'}
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Activity timeline
          </h3>
          {activities.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-700">
                      {a.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400">
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                  {(a.fromValue || a.toValue) && (
                    <p className="text-xs text-slate-500">
                      {a.fromValue && <span>{a.fromValue}</span>}
                      {a.fromValue && a.toValue && (
                        <span className="mx-1.5 text-slate-300">→</span>
                      )}
                      {a.toValue && <span>{a.toValue}</span>}
                    </p>
                  )}
                  {a.note && (
                    <p className="whitespace-pre-line text-sm text-slate-700">
                      {a.note}
                    </p>
                  )}
                  {a.actorName && (
                    <p className="text-[11px] text-slate-400">
                      by {a.actorName}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={convertOpen}
        onClose={() => !converting && setConvertOpen(false)}
        title="Convert lead to opportunity"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConvertOpen(false)}
              disabled={converting}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={confirmConvert} disabled={converting}>
              {converting ? 'Converting…' : 'Confirm convert'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Promote <strong>{lead.fullName}</strong> to an opportunity? You can
          continue tracking them under <em>Opportunities</em> and later convert
          the opportunity into a client.
        </p>
      </Modal>
    </DashboardLayout>
  );
}
