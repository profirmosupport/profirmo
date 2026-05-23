'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, RefreshCw, Search } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ClientTable from '@/components/dashboard/ClientTable';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Avatar from '@/components/common/Avatar';
import Badge from '@/components/common/Badge';
import clientService from '@/services/clientService';
import { ROLES } from '@/utils/constants';

const USER_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'business', label: 'Business' },
];

const EMPTY_NEW_FORM = {
  name: '',
  email: '',
  city: '',
  userType: 'individual',
};

function unwrapList(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.data)) return res.data;
  if (res && res.data && Array.isArray(res.data.data)) return res.data.data;
  return [];
}

export default function ProfessionalClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Add-client modal state.
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('lookup'); // lookup | foundUser | foundClient | newForm
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [foundClient, setFoundClient] = useState(null);
  const [newForm, setNewForm] = useState(EMPTY_NEW_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await clientService.getAll();
      setClients(unwrapList(res));
    } catch (err) {
      setLoadError(err.message || 'Failed to load clients.');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetModal() {
    setStep('lookup');
    setPhone('');
    setSearching(false);
    setSearchError('');
    setFoundUser(null);
    setFoundClient(null);
    setNewForm(EMPTY_NEW_FORM);
    setSubmitting(false);
    setSubmitError('');
  }

  function openModal() {
    resetModal();
    setOpen(true);
  }

  function closeModal() {
    if (searching || submitting) return;
    setOpen(false);
    resetModal();
  }

  async function submitLookup(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (searching) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      setSearchError('Enter a phone number to look up.');
      return;
    }
    setSearchError('');
    setSearching(true);
    try {
      const result = await clientService.searchByPhone(trimmed);
      const user = result && result.user;
      if (user) {
        setFoundUser(user);
        setStep('foundUser');
      } else {
        setNewForm((f) => ({ ...f, name: '', email: '', city: '' }));
        setStep('newForm');
      }
    } catch (err) {
      setSearchError(err.message || 'Lookup failed.');
    } finally {
      setSearching(false);
    }
  }

  async function createFromUser() {
    if (!foundUser || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // The user already exists; just link them to the calling professional.
      await clientService.linkExisting(foundUser.id);
      setOpen(false);
      resetModal();
      await load();
    } catch (err) {
      setSubmitError(err.message || 'Could not link client.');
    } finally {
      setSubmitting(false);
    }
  }

  async function createFromExistingClient() {
    if (!foundClient) return;
    // The client already exists — just close + refresh to surface them.
    setOpen(false);
    resetModal();
    await load();
  }

  async function submitNewClient(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;
    if (!newForm.name.trim()) {
      setSubmitError('Name is required.');
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const created = await clientService.create({
        name: newForm.name.trim(),
        email: newForm.email.trim(),
        phone: phone.trim(),
        city: newForm.city.trim(),
        userType: newForm.userType,
      });
      if (created && created.inviteSent) {
        setInviteNotice(
          `Invitation email sent to ${created.email}. They can claim their account from that link.`
        );
      } else {
        setInviteNotice('');
      }
      setOpen(false);
      resetModal();
      await load();
    } catch (err) {
      setSubmitError(err.message || 'Could not create client.');
    } finally {
      setSubmitting(false);
    }
  }

  const modalTitle =
    step === 'lookup'
      ? 'Add client'
      : step === 'foundUser'
      ? 'Platform user found'
      : step === 'foundClient'
      ? 'Existing client found'
      : 'New client details';

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title="Clients"
      subtitle="People you are advising"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {loading
              ? 'Loading clients…'
              : `${clients.length} client${clients.length === 1 ? '' : 's'}`}
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
            <Button size="sm" onClick={openModal}>
              <UserPlus size={15} />
              Add client
            </Button>
          </div>
        </div>

        {loadError && (
          <Card>
            <p className="text-sm text-red-600">{loadError}</p>
          </Card>
        )}

        {inviteNotice && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span>{inviteNotice}</span>
            <button
              type="button"
              onClick={() => setInviteNotice('')}
              className="text-emerald-700/70 hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <ClientTable clients={clients} />
        )}
      </div>

      <Modal
        open={open}
        onClose={closeModal}
        title={modalTitle}
        footer={
          step === 'lookup' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={closeModal}
                disabled={searching}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submitLookup}
                disabled={searching || !phone.trim()}
              >
                {searching ? 'Looking up…' : 'Look up'}
              </Button>
            </>
          ) : step === 'foundUser' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('lookup')}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={createFromUser}
                disabled={submitting}
              >
                {submitting ? 'Adding…' : 'Use this user'}
              </Button>
            </>
          ) : step === 'foundClient' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('lookup')}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={createFromExistingClient}
                disabled={submitting}
              >
                Use this existing client
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('lookup')}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submitNewClient}
                disabled={submitting || !newForm.name.trim()}
              >
                {submitting ? 'Creating…' : 'Add as new client'}
              </Button>
            </>
          )
        }
      >
        {step === 'lookup' && (
          <form onSubmit={submitLookup} className="space-y-3">
            <Input
              label="Phone number"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              required
              hint="We will look this phone up against existing platform users and your clients."
            />
            <button type="submit" className="hidden" aria-hidden="true" />
            {searchError && (
              <p className="text-xs text-red-600">{searchError}</p>
            )}
          </form>
        )}

        {step === 'foundUser' && foundUser && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              We found a platform user with this phone number. Add them as your
              client.
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Avatar
                src={foundUser.profilePhoto}
                name={
                  foundUser.fullName ||
                  [foundUser.firstName, foundUser.lastName]
                    .filter(Boolean)
                    .join(' ') ||
                  foundUser.email ||
                  'User'
                }
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {foundUser.fullName ||
                    [foundUser.firstName, foundUser.lastName]
                      .filter(Boolean)
                      .join(' ') ||
                    '—'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {foundUser.email || '—'}
                </p>
              </div>
              {foundUser.role && (
                <Badge variant="gray">{foundUser.role}</Badge>
              )}
            </div>
            {submitError && (
              <p className="text-xs text-red-600">{submitError}</p>
            )}
          </div>
        )}

        {step === 'foundClient' && foundClient && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              A client with this phone already exists on file.
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Avatar name={foundClient.name || 'Client'} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {foundClient.name || '—'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {foundClient.email || '—'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {foundClient.phone || '—'}
                </p>
              </div>
            </div>
            {submitError && (
              <p className="text-xs text-red-600">{submitError}</p>
            )}
          </div>
        )}

        {step === 'newForm' && (
          <form onSubmit={submitNewClient} className="space-y-3">
            <p className="text-sm text-slate-600">
              No match found. Fill in the details to add this person as a new
              client.
            </p>
            <Input
              label="Phone number"
              name="newPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <Input
              label="Name"
              name="name"
              value={newForm.name}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={newForm.email}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="Optional"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="City"
                name="city"
                value={newForm.city}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, city: e.target.value }))
                }
                placeholder="Optional"
              />
              <Select
                label="Client type"
                name="userType"
                value={newForm.userType}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, userType: e.target.value }))
                }
                options={USER_TYPE_OPTIONS}
              />
            </div>
            <button type="submit" className="hidden" aria-hidden="true" />
            {submitError && (
              <p className="text-xs text-red-600">{submitError}</p>
            )}
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
}
