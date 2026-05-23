'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users,
  UserPlus,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import Avatar from '@/components/common/Avatar';
import { useLanguage } from '@/components/LanguageProvider';
import {
  getLawFirm,
  updateFirmMember,
  removeFirmMember,
  createFirmInvitation,
} from '@/services/profileService';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import { ROLES } from '@/utils/constants';

function roleBadgeVariant(role) {
  if (role === 'owner') return 'green';
  if (role === 'co-owner') return 'amber';
  return 'gray';
}

function roleLabel(role) {
  if (!role) return 'Member';
  return String(role)
    .replace(/_/g, ' ')
    .replace(/-/g, '-')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * MemberActionsMenu — kebab dropdown for promote / demote / remove actions.
 * Mirrors the pattern used in app/admin/users/page.js.
 */
function MemberActionsMenu({ role, onPromote, onDemote, onRemove }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
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
        aria-label="Open actions menu"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-amber-300 hover:bg-slate-50"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card-lg"
        >
          {role === 'member' && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPromote();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowUp size={14} /> Promote to co-owner
            </button>
          )}
          {role === 'co-owner' && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDemote();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowDown size={14} /> Demote to member
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <Trash2 size={14} /> Remove from firm
          </button>
        </div>
      )}
    </div>
  );
}

export default function FirmProfessionalsPage() {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [members, setMembers] = useState([]);

  const [actingId, setActingId] = useState(null);
  const [actionError, setActionError] = useState('');

  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  // Invite-member modal.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member',
    message: '',
  });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getLawFirm();
      const list = data && Array.isArray(data.members) ? data.members : [];
      setMembers(list);
    } catch (err) {
      setError(err.message || 'Failed to load firm members.');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function promote(member) {
    setActingId(member.id);
    setActionError('');
    try {
      await updateFirmMember(member.id, { role: 'co-owner' });
      await load();
    } catch (err) {
      setActionError(err.message || 'Failed to promote member.');
    } finally {
      setActingId(null);
    }
  }

  async function demote(member) {
    setActingId(member.id);
    setActionError('');
    try {
      await updateFirmMember(member.id, { role: 'member' });
      await load();
    } catch (err) {
      setActionError(err.message || 'Failed to demote member.');
    } finally {
      setActingId(null);
    }
  }

  function openRemove(member) {
    setRemoveError('');
    setRemoveTarget(member);
  }

  function closeRemove() {
    if (removing) return;
    setRemoveTarget(null);
    setRemoveError('');
  }

  function closeInvite() {
    if (inviting) return;
    setInviteOpen(false);
    setInviteForm({ email: '', role: 'member', message: '' });
    setInviteError('');
    setInviteSuccess('');
  }

  async function submitInvite(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (inviting) return;
    const email = inviteForm.email.trim();
    if (!email) {
      setInviteError('Email is required.');
      return;
    }
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      await createFirmInvitation({
        email,
        role: inviteForm.role,
        message: inviteForm.message.trim() || undefined,
      });
      setInviteSuccess(
        `Invitation sent to ${email}. They will join once they accept (after registering as a professional if needed).`
      );
      setInviteForm({ email: '', role: 'member', message: '' });
    } catch (err) {
      setInviteError(err.message || 'Failed to send the invitation.');
    } finally {
      setInviting(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError('');
    try {
      await removeFirmMember(removeTarget.id);
      setRemoveTarget(null);
      await load();
    } catch (err) {
      setRemoveError(err.message || 'Failed to remove member.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.FIRM_ADMIN}
      title="Professionals"
      subtitle={t('dashFirm.team.desc')}
    >
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {t('dashFirm.team.title')}
            </h2>
            <p className="text-sm text-slate-500">{t('dashFirm.team.desc')}</p>
          </div>
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
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus size={15} />
              Invite member
            </Button>
          </div>
        </div>

        {actionError && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} />
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </span>
              <p className="text-sm font-medium text-slate-700">{error}</p>
              <Button size="sm" onClick={load}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          </Card>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title={t('dashFirm.team.emptyTitle')}
            description={t('dashFirm.team.emptyDesc')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => {
              const isOwner = m.role === 'owner';
              const busy = actingId === m.id;
              return (
                <Card key={m.id} hover>
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={m.profilePhoto}
                      name={m.name}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium text-slate-800">
                          {m.name || '—'}
                        </p>
                        {!isOwner && (
                          <MemberActionsMenu
                            role={m.role}
                            onPromote={() => promote(m)}
                            onDemote={() => demote(m)}
                            onRemove={() => openRemove(m)}
                          />
                        )}
                      </div>
                      {m.email && (
                        <p className="truncate text-xs text-slate-500">
                          {m.email}
                        </p>
                      )}
                      {m.professionalType && (
                        <p className="truncate text-xs text-slate-500">
                          {m.professionalType}
                        </p>
                      )}
                      <div className="mt-2">
                        <Badge variant={roleBadgeVariant(m.role)}>
                          {isOwner ? 'Owner' : roleLabel(m.role)}
                        </Badge>
                        {busy && (
                          <span className="ml-2 text-xs text-slate-400">
                            Saving…
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Remove member confirm modal */}
      <Modal
        open={!!removeTarget}
        onClose={closeRemove}
        title="Remove from firm"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeRemove}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmRemove}
              disabled={removing}
            >
              {removing ? 'Removing…' : 'Remove member'}
            </Button>
          </>
        }
      >
        {removeTarget && (
          <p className="text-sm text-slate-600">
            Remove <strong>{removeTarget.name || 'this member'}</strong> from
            the firm? They will lose access to firm resources and will need to
            be re-invited to rejoin.
          </p>
        )}
        {removeError && (
          <p className="mt-3 text-xs text-red-600">{removeError}</p>
        )}
      </Modal>

      {/* Invite member modal */}
      <Modal
        open={inviteOpen}
        onClose={closeInvite}
        title="Invite a member"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeInvite}
              disabled={inviting}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitInvite}
              disabled={inviting || !inviteForm.email.trim()}
            >
              {inviting ? 'Sending…' : 'Send invitation'}
            </Button>
          </>
        }
      >
        <form onSubmit={submitInvite} className="space-y-3">
          <p className="text-xs text-slate-500">
            We&apos;ll email an invitation link. The invitee must register as a
            professional on the platform before they can accept and join your
            firm.
          </p>
          <Input
            label="Email"
            name="email"
            type="email"
            value={inviteForm.email}
            onChange={(e) =>
              setInviteForm((f) => ({ ...f, email: e.target.value }))
            }
            required
          />
          <Select
            label="Role"
            name="role"
            value={inviteForm.role}
            onChange={(e) =>
              setInviteForm((f) => ({ ...f, role: e.target.value }))
            }
            options={[
              { value: 'member', label: 'Member' },
              { value: 'co-owner', label: 'Co-owner' },
            ]}
          />
          <div>
            <label
              htmlFor="invite-message"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Message (optional)
            </label>
            <textarea
              id="invite-message"
              name="message"
              rows={3}
              value={inviteForm.message}
              onChange={(e) =>
                setInviteForm((f) => ({ ...f, message: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <button type="submit" className="hidden" aria-hidden="true" />
          {inviteError && (
            <p className="text-xs text-red-600">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {inviteSuccess}
            </p>
          )}
        </form>
      </Modal>
    </DashboardLayout>
  );
}
