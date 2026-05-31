'use client';

// PersonalInfoForm — edits name, mobile, profile photo URL and address.
// Used by all roles on the profile edit page. Saves via PUT /api/profile.

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Edit3 } from 'lucide-react';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Combobox from '@/components/common/Combobox';
import Button from '@/components/common/Button';
import PhotoUpload from '@/components/common/PhotoUpload';
import { updateProfile } from '@/services/profileService';
import { useLocations } from '@/hooks/useLocations';
import ChangePhoneModal from '@/components/profile/ChangePhoneModal';

function buildInitialState(user, address) {
  const u = user || {};
  const a = address || {};
  return {
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    mobileNumber: u.mobileNumber || '',
    profilePhoto: u.profilePhoto || '',
    coverPhoto: u.coverPhoto || '',
    country: a.country || '',
    state: a.state || '',
    city: a.city || '',
    addressLine: a.addressLine || '',
    postalCode: a.postalCode || '',
  };
}

/**
 * PersonalInfoForm
 * Props:
 *  - user, address: prefill data
 *  - onSaved: (refreshedProfile) => void — called after a successful save
 */
export default function PersonalInfoForm({ user, address, onSaved }) {
  const [form, setForm] = useState(() => buildInitialState(user, address));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Cascading Country -> State -> City. We store the human-readable names
  // on the form state to keep back-compat with the existing PUT /api/profile
  // payload shape, but use the ids for dropdown selection.
  const {
    countries,
    statesByCountry,
    citiesByState,
    countryById,
    stateById,
    cityById,
  } = useLocations();
  const selectedCountryId =
    countries.find((c) => c.name === form.country)?.id || '';
  const stateRows = statesByCountry(selectedCountryId);
  const selectedStateId =
    stateRows.find((s) => s.name === form.state)?.id || '';
  const cityRowsForState = citiesByState(selectedStateId);
  const selectedCityId =
    cityRowsForState.find((c) => c.name === form.city)?.id || '';
  function pickCountry(id) {
    const c = countryById(id);
    setForm((f) => ({ ...f, country: c ? c.name : '', state: '', city: '' }));
  }
  function pickState(id) {
    const s = stateById(id);
    setForm((f) => ({ ...f, state: s ? s.name : '', city: '' }));
  }
  function pickCity(id) {
    const c = cityById(id);
    setForm((f) => ({ ...f, city: c ? c.name : '' }));
  }
  const [feedback, setFeedback] = useState(null); // { type, message }
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    const next = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.lastName.trim()) next.lastName = 'Last name is required.';
    // Mobile number is changed via the OTP modal only — not validated here.
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        // mobileNumber is intentionally omitted — it can only be updated
        // through the OTP-verified change-phone flow (the modal below).
        profilePhoto: form.profilePhoto.trim() || undefined,
        coverPhoto: form.coverPhoto.trim() || undefined,
        address: {
          country: form.country.trim(),
          state: form.state.trim(),
          city: form.city.trim(),
          addressLine: form.addressLine.trim(),
          postalCode: form.postalCode.trim(),
        },
      };
      const refreshed = await updateProfile(payload);
      setFeedback({
        type: 'success',
        message: 'Personal information saved.',
      });
      if (typeof onSaved === 'function') await onSaved(refreshed);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Could not save your changes.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Personal information
          </h2>
          <p className="text-sm text-slate-500">
            Your name, contact details and photo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            required
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            error={errors.firstName}
          />
          <Input
            label="Last name"
            name="lastName"
            required
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            error={errors.lastName}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Mobile number
            </label>
            <div className="flex items-center gap-2">
              <input
                type="tel"
                value={form.mobileNumber || '(not set)'}
                readOnly
                disabled
                className="flex-1 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPhoneModalOpen(true)}
              >
                <Edit3 size={14} />
                Change
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Changing your phone number requires verifying the new number
              via OTP.
            </p>
          </div>
        </div>
        <ChangePhoneModal
          open={phoneModalOpen}
          currentPhone={form.mobileNumber}
          onClose={() => setPhoneModalOpen(false)}
          onChanged={async (newPhone) => {
            setForm((f) => ({ ...f, mobileNumber: newPhone }));
            setFeedback({
              type: 'success',
              message: 'Mobile number updated.',
            });
            setPhoneModalOpen(false);
            if (typeof onSaved === 'function') {
              try {
                await onSaved(null);
              } catch {
                /* ignore — the form has already reflected the change */
              }
            }
          }}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Profile photo
            </span>
            <PhotoUpload
              shape="circle"
              category="profile_photo"
              value={form.profilePhoto}
              onChange={(url) => update('profilePhoto', url)}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Cover photo
            </span>
            <PhotoUpload
              shape="banner"
              category="cover_photo"
              value={form.coverPhoto}
              onChange={(url) => update('coverPhoto', url)}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-800">Address</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Address line"
              name="addressLine"
              value={form.addressLine}
              onChange={(e) => update('addressLine', e.target.value)}
              className="sm:col-span-2"
            />
            <Combobox
              label="Country"
              name="country"
              value={selectedCountryId}
              onChange={(e) => pickCountry(e.target.value)}
              options={countries.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select country…"
            />
            <Combobox
              label="State"
              name="state"
              value={selectedStateId}
              onChange={(e) => pickState(e.target.value)}
              options={stateRows.map((s) => ({ value: s.id, label: s.name }))}
              placeholder={
                selectedCountryId ? 'Select state…' : 'Pick a country first'
              }
              disabled={!selectedCountryId}
            />
            <Combobox
              label="City"
              name="city"
              value={selectedCityId}
              onChange={(e) => pickCity(e.target.value)}
              options={cityRowsForState.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              placeholder={
                selectedStateId ? 'Select city…' : 'Pick a state first'
              }
              disabled={!selectedStateId}
            />
            <Input
              label="Postal code"
              name="postalCode"
              value={form.postalCode}
              onChange={(e) => update('postalCode', e.target.value)}
            />
          </div>
        </div>

        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {feedback.message}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {saving ? 'Saving…' : 'Save personal information'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
