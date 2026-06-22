'use client';

// AddClientModal — multi-step modal for adding a client. Steps:
//   1. lookup         — enter phone → query /api/clients/search-by-phone
//   2. foundUser      — existing client-user matched; offer to link
//   3. nonClientUser  — phone is owned by a non-client account (pro,
//                       admin, etc.) → refuse with explanation. No
//                       new client can be created with that phone.
//   4. newForm        — no match; collect name / email / city /
//                       entity-type and create. On success the new
//                       user row gets a starter ClientComplianceProfile
//                       so the manage page lands you ready to generate.

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Combobox from '@/components/common/Combobox';
import Avatar from '@/components/common/Avatar';
import Badge from '@/components/common/Badge';
import clientService from '@/services/clientService';
import { listCities } from '@/services/appSettingsService';
import { saveProfile } from '@/services/complianceService';

// Entity types — same list as the compliance editor so the new
// client lands with the right rules ready to generate. The first nine
// match config/entityTypeRequirements.js exactly.
const ENTITY_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'sole_proprietor', label: 'Sole proprietor' },
  { value: 'partnership', label: 'Partnership firm' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_ltd', label: 'Private limited' },
  { value: 'public_ltd', label: 'Public limited' },
  { value: 'huf', label: 'HUF' },
  { value: 'trust', label: 'Trust' },
  { value: 'society', label: 'Society' },
];

// Map entity → coarse userType column for backward compat. Anyone
// non-individual is treated as a business for the existing badge /
// filters that consume userType.
function userTypeFor(entityType) {
  return entityType === 'individual' ? 'individual' : 'business';
}

const EMPTY_NEW_FORM = {
  name: '',
  email: '',
  city: '',
  entityType: 'individual',
};

export default function AddClientModal({ open, onClose, onAdded }) {
  const [step, setStep] = useState('lookup');
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [nonClientRole, setNonClientRole] = useState(null);
  const [newForm, setNewForm] = useState(EMPTY_NEW_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Cities catalog — loaded once when the modal opens, kept across
  // step transitions so switching back/forth doesn't re-fetch.
  const [cityOptions, setCityOptions] = useState([]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const rows = await listCities();
        const list = Array.isArray(rows) ? rows : [];
        setCityOptions(
          list
            .filter((c) => c && c.name)
            .map((c) => ({ value: c.name, label: c.name }))
        );
      } catch {
        setCityOptions([]);
      }
    })();
  }, [open]);

  function reset() {
    setStep('lookup');
    setPhone('');
    setSearching(false);
    setSearchError('');
    setFoundUser(null);
    setNonClientRole(null);
    setNewForm(EMPTY_NEW_FORM);
    setSubmitting(false);
    setSubmitError('');
  }

  function handleClose() {
    if (searching || submitting) return;
    reset();
    if (typeof onClose === 'function') onClose();
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
      if (result && result.user) {
        setFoundUser(result.user);
        setStep('foundUser');
      } else if (result && result.existsAsNonClient) {
        setNonClientRole(result.role || 'user');
        setStep('nonClientUser');
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

  async function linkFoundUser() {
    if (!foundUser || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await clientService.linkExisting(foundUser.id);
      if (typeof onAdded === 'function') await onAdded(result);
      reset();
      onClose && onClose();
    } catch (err) {
      setSubmitError(err.message || 'Could not link client.');
    } finally {
      setSubmitting(false);
    }
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
        userType: userTypeFor(newForm.entityType),
      });
      // Seed a compliance profile with the entity type so the manage
      // page can immediately list applicable docs + services + offer
      // Save+generate. created.id is the new client's userId.
      try {
        const newClientId = created && (created.id || (created.user && created.user.id));
        if (newClientId && newForm.entityType) {
          await saveProfile(newClientId, { entityType: newForm.entityType });
        }
      } catch {
        // Profile seed is best-effort — manage page can save it later.
      }
      if (typeof onAdded === 'function') await onAdded(created);
      reset();
      onClose && onClose();
    } catch (err) {
      setSubmitError(err.message || 'Could not create client.');
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    step === 'lookup'
      ? 'Add client'
      : step === 'foundUser'
        ? 'Platform user found'
        : step === 'nonClientUser'
          ? 'Phone in use'
          : 'New client details';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        step === 'lookup' ? (
          <>
            <Button variant="outline" size="sm" onClick={handleClose} disabled={searching}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitLookup}
              disabled={searching || !phone.trim()}
            >
              <Search size={14} />
              {searching ? 'Looking up…' : 'Look up'}
            </Button>
          </>
        ) : step === 'foundUser' ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setStep('lookup')} disabled={submitting}>
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={linkFoundUser}
              disabled={submitting}
            >
              {submitting ? 'Adding…' : 'Add to my clients'}
            </Button>
          </>
        ) : step === 'nonClientUser' ? (
          <Button variant="outline" size="sm" onClick={() => setStep('lookup')}>
            Try another number
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => setStep('lookup')} disabled={submitting}>
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
            hint="We will look this phone up against existing platform users."
          />
          <button type="submit" className="hidden" aria-hidden="true" />
          {searchError && <p className="text-xs text-red-600">{searchError}</p>}
        </form>
      )}

      {step === 'foundUser' && foundUser && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            This phone is already a client account on Profirmo. Add them to
            your client list — they'll appear on your dashboard
            immediately.
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Avatar
              src={foundUser.profilePhoto}
              name={foundUser.name || foundUser.email || 'User'}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {foundUser.name || '—'}
              </p>
              <p className="truncate text-xs text-slate-500">
                {foundUser.email || '—'}
              </p>
              <p className="truncate text-xs text-slate-500">
                {foundUser.phone || ''}
              </p>
            </div>
            {foundUser.role && <Badge variant="gray">{foundUser.role}</Badge>}
          </div>
          <p className="text-[11px] text-slate-500">
            They can be your client AND someone else's client at the same
            time — Profirmo links them to each professional independently.
          </p>
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
        </div>
      )}

      {step === 'nonClientUser' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            This phone number is already in use by a{' '}
            <span className="font-semibold">{nonClientRole}</span> account on
            Profirmo, so we can't add it as a client. If this person should
            also be a client, ask them to add a separate client account
            (different phone number) — or contact support if you think this
            is wrong.
          </p>
        </div>
      )}

      {step === 'newForm' && (
        <form onSubmit={submitNewClient} className="space-y-3">
          <p className="text-sm text-slate-600">
            No platform account on this phone. Fill in the basics — we'll
            also seed a starter compliance profile for the entity type you
            pick.
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
            onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
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
            hint="Provide an email so the client receives an invitation to claim their account."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Combobox
              label="City"
              name="city"
              value={newForm.city}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, city: e.target.value }))
              }
              options={cityOptions}
              placeholder={
                cityOptions.length === 0 ? 'Loading cities…' : 'Search cities…'
              }
              emptyLabel="No match — leave blank or pick later"
            />
            <Combobox
              label="Entity type"
              name="entityType"
              value={newForm.entityType}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, entityType: e.target.value }))
              }
              options={ENTITY_TYPE_OPTIONS}
            />
          </div>
          <button type="submit" className="hidden" aria-hidden="true" />
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
        </form>
      )}
    </Modal>
  );
}
