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
  ExternalLink,
  Search,
  Loader2,
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
import { searchProfessionals } from '@/services/firmService';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import PlanLimitBanner from '@/components/common/PlanLimitBanner';
import QuotaBanner from '@/components/common/QuotaBanner';
import RowMenu from '@/components/common/RowMenu';
import { getMyUsage } from '@/services/subscriptionService';
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
  return (
    <RowMenu width="w-52">
      {role === 'member' && (
        <button
          type="button"
          role="menuitem"
          onClick={onPromote}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowUp size={14} /> Promote to co-owner
        </button>
      )}
      {role === 'co-owner' && (
        <button
          type="button"
          role="menuitem"
          onClick={onDemote}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowDown size={14} /> Demote to member
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={onRemove}
        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
      >
        <Trash2 size={14} /> Remove from firm
      </button>
    </RowMenu>
  );
}

export default function FirmProfessionalsPage() {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [members, setMembers] = useState([]);
  // Subscription quota snapshot — drives the per-firm member cap card.
  // null while loading; once resolved, `usage.firmMembers` is populated
  // for firm owners (members/non-owners get null for that slice).
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
  const [inviteErrorObj, setInviteErrorObj] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [emailSearching, setEmailSearching] = useState(false);
  const [emailSelected, setEmailSelected] = useState(null);

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
    setEmailSuggestions([]);
    setEmailSearching(false);
    setEmailSelected(null);
  }

  // Debounced email autocomplete against /api/law-firm/search-professionals.
  useEffect(() => {
    if (!inviteOpen) return undefined;
    const q = inviteForm.email.trim();
    if (q.length < 2) {
      setEmailSuggestions([]);
      setEmailSearching(false);
      return undefined;
    }
    // If the user has clicked a suggestion and the email matches, don't keep
    // re-firing the search — it's already locked in.
    if (emailSelected && emailSelected.email === q) {
      return undefined;
    }
    let active = true;
    setEmailSearching(true);
    const handle = setTimeout(async () => {
      try {
        const list = await searchProfessionals(q);
        if (active) setEmailSuggestions(Array.isArray(list) ? list : []);
      } catch {
        if (active) setEmailSuggestions([]);
      } finally {
        if (active) setEmailSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [inviteForm.email, inviteOpen, emailSelected]);

  function pickSuggestion(s) {
    setInviteForm((f) => ({ ...f, email: s.email || '' }));
    setEmailSelected(s);
    setEmailSuggestions([]);
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
      setInviteErrorObj(err);
      const isPlanLimit =
        err && err.payload && err.payload.code === 'PLAN_LIMIT_REACHED';
      setInviteError(
        isPlanLimit ? '' : err.message || 'Failed to send the invitation.'
      );
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
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-900">
            {t('dashFirm.team.title')}
          </h2>
          <p className="text-sm text-slate-500">{t('dashFirm.team.desc')}</p>
        </div>

        {/* Plan quota card — when the caller owns the firm. Hosts both the
            Refresh and Invite member buttons inline. Invite button is
            disabled when the firm's professional cap is reached. Refresh
            does a full window reload per spec so every cached quota / row
            is fetched fresh. */}
        {usage && usage.firmMembers ? (
          <div className="mb-3">
            <QuotaBanner
              label="Professionals"
              used={usage.firmMembers.used}
              limit={usage.firmMembers.limit}
              remaining={usage.firmMembers.remaining}
              unlimited={usage.firmMembers.unlimited}
              planName={usage.firmMembers.planName || usage.planName}
              helpText="Cap is on additional professionals only — the firm owner is not included in the count."
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (typeof window !== 'undefined') window.location.reload();
                    }}
                    disabled={loading}
                  >
                    <RefreshCw size={15} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setInviteOpen(true)}
                    disabled={usage.firmMembers.remaining === 0}
                    title={
                      usage.firmMembers.remaining === 0
                        ? 'Professional limit reached — upgrade the firm owner’s plan to add more.'
                        : undefined
                    }
                  >
                    <UserPlus size={15} />
                    Invite member
                  </Button>
                </>
              }
            />
          </div>
        ) : (
          // Fallback toolbar — non-owner roles (or unbackfilled accounts)
          // still need the page-level buttons to function.
          <div className="mb-3 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
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
        )}

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
                      src={m.profilePhoto || (m.professional && m.professional.profilePhoto)}
                      name={m.name || (m.professional && m.professional.name)}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium text-slate-800">
                          {m.name || (m.professional && m.professional.name) || '—'}
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
                      {(m.email || (m.professional && m.professional.email)) && (
                        <p className="truncate text-xs text-slate-500">
                          {m.email || m.professional.email}
                        </p>
                      )}
                      {(m.professionalType ||
                        (m.professional && m.professional.professionalType)) && (
                        <p className="truncate text-xs text-slate-500">
                          {m.professionalType || m.professional.professionalType}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={roleBadgeVariant(m.role)}>
                          {isOwner ? 'Owner' : roleLabel(m.role)}
                        </Badge>
                        {(m.publicId ||
                          (m.professional && m.professional.publicId)) && (
                          <a
                            href={`/professionals/${
                              m.publicId ||
                              (m.professional && m.professional.publicId)
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700"
                          >
                            View profile
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {busy && (
                          <span className="text-xs text-slate-400">
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
          <div>
            <label
              htmlFor="invite-email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <div className="relative">
              <input
                id="invite-email"
                name="email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => {
                  setInviteForm((f) => ({ ...f, email: e.target.value }));
                  // Typing breaks the "selected suggestion" lock.
                  if (emailSelected && emailSelected.email !== e.target.value) {
                    setEmailSelected(null);
                  }
                }}
                placeholder="Start typing to search approved professionals…"
                autoComplete="off"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              {emailSearching && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>
            {emailSuggestions.length > 0 && (
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {emailSuggestions.map((s) => (
                  <li key={s.userId}>
                    <button
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-amber-50"
                    >
                      <span className="text-sm font-medium text-slate-800">
                        {s.fullName || s.email}
                      </span>
                      <span className="truncate text-xs text-slate-500">
                        {s.email}
                        {s.professionalType ? ` · ${s.professionalType}` : ''}
                      </span>
                      {s.currentFirm && (
                        <span
                          className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            s.currentFirm.isMyFirm
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          <AlertTriangle size={11} />
                          {s.currentFirm.isMyFirm
                            ? `Already in your firm (${s.currentFirm.role || 'member'})`
                            : `Already in ${s.currentFirm.firmName || 'another firm'}`}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {emailSelected && emailSelected.currentFirm && (
              <div
                className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                  emailSelected.currentFirm.isMyFirm
                    ? 'bg-slate-50 text-slate-600'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {emailSelected.currentFirm.isMyFirm
                    ? `${emailSelected.fullName || emailSelected.email} is already a member of your firm.`
                    : `${
                        emailSelected.fullName || emailSelected.email
                      } is already a member of ${
                        emailSelected.currentFirm.firmName ||
                        'another firm'
                      }. They must leave that firm before they can accept your invitation.`}
                </span>
              </div>
            )}
          </div>
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
          <PlanLimitBanner err={inviteErrorObj} />
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
