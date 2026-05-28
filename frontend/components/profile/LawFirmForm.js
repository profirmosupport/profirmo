'use client';

// LawFirmForm — create or edit the law firm owned by a firm_admin.
// POSTs /api/law-firm when no firm exists yet, otherwise PUTs
// /api/law-firm/mine.

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Combobox from '@/components/common/Combobox';
import Button from '@/components/common/Button';
import PhotoUpload from '@/components/common/PhotoUpload';
import FileUpload from '@/components/common/FileUpload';
import { createLawFirm, updateLawFirm } from '@/services/profileService';
import { useLocations } from '@/hooks/useLocations';

function toArray(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toCsv(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.filter(Boolean).join(', ');
}

function buildInitialState(firm) {
  const f = firm || {};
  const social = f.socialLinks || {};
  return {
    firmName: f.firmName || f.name || '',
    registrationNumber: f.registrationNumber || '',
    logo: f.logo || '',
    website: f.website || '',
    establishedYear:
      f.establishedYear === 0 || f.establishedYear
        ? String(f.establishedYear)
        : '',
    about: f.about || '',
    headquarters: f.headquarters || '',
    contactEmail: f.contactEmail || '',
    contactNumber: f.contactNumber || '',
    totalEmployees:
      f.totalEmployees === 0 || f.totalEmployees
        ? String(f.totalEmployees)
        : '',
    numberOfProfessionals:
      f.numberOfProfessionals === 0 || f.numberOfProfessionals
        ? String(f.numberOfProfessionals)
        : '',
    practiceAreas: toCsv(f.practiceAreas),
    linkedin: social.linkedin || '',
    twitter: social.twitter || '',
    facebook: social.facebook || '',
    registrationCertificate: f.registrationCertificate || '',
    businessLicense: f.businessLicense || '',
    taxDocuments: Array.isArray(f.taxDocuments)
      ? f.taxDocuments.filter(Boolean)
      : f.taxDocument
        ? [f.taxDocument]
        : [],
  };
}

/**
 * LawFirmForm
 * Props:
 *  - lawFirm: existing firm object or null
 *  - onSaved: (savedFirm) => void
 */
export default function LawFirmForm({ lawFirm, onSaved }) {
  const [form, setForm] = useState(() => buildInitialState(lawFirm));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const { flatCities, cityById } = useLocations();
  // The firm's headquarters is stored as a city name for back-compat. We
  // resolve to id for the Combobox and write the name back on pick.
  const cityOptions = flatCities.map((c) => ({ value: c.id, label: c.label }));
  const headquartersCityId =
    flatCities.find(
      (c) => c.name.toLowerCase() === String(form.headquarters || '').toLowerCase()
    )?.id || '';

  const isNew = !lawFirm;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // ---- tax documents (array of URL strings) --------------------------------
  function addTaxDoc() {
    setForm((f) => ({ ...f, taxDocuments: [...f.taxDocuments, ''] }));
  }

  function updateTaxDoc(index, url) {
    setForm((f) => {
      const next = [...f.taxDocuments];
      next[index] = url;
      return { ...f, taxDocuments: next };
    });
  }

  function removeTaxDoc(index) {
    setForm((f) => ({
      ...f,
      taxDocuments: f.taxDocuments.filter((_, i) => i !== index),
    }));
  }

  function validate() {
    const next = {};
    if (!form.firmName.trim()) next.firmName = 'Firm name is required.';
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
        firmName: form.firmName.trim(),
        registrationNumber: form.registrationNumber.trim(),
        logo: form.logo.trim() || undefined,
        website: form.website.trim(),
        establishedYear: form.establishedYear
          ? Number(form.establishedYear)
          : undefined,
        about: form.about.trim(),
        headquarters: form.headquarters.trim(),
        contactEmail: form.contactEmail.trim(),
        contactNumber: form.contactNumber.trim(),
        totalEmployees: form.totalEmployees
          ? Number(form.totalEmployees)
          : undefined,
        numberOfProfessionals: form.numberOfProfessionals
          ? Number(form.numberOfProfessionals)
          : undefined,
        practiceAreas: toArray(form.practiceAreas),
        socialLinks: {
          linkedin: form.linkedin.trim(),
          twitter: form.twitter.trim(),
          facebook: form.facebook.trim(),
        },
        registrationCertificate: form.registrationCertificate.trim() || undefined,
        businessLicense: form.businessLicense.trim() || undefined,
        taxDocuments: form.taxDocuments
          .map((url) => (url || '').trim())
          .filter(Boolean),
      };

      const saved = isNew
        ? await createLawFirm(payload)
        : await updateLawFirm(payload);
      setFeedback({
        type: 'success',
        message: isNew ? 'Law firm created.' : 'Law firm details saved.',
      });
      if (typeof onSaved === 'function') await onSaved(saved);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Could not save your law firm.',
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
            {isNew ? 'Create your law firm' : 'Law firm details'}
          </h2>
          <p className="text-sm text-slate-500">
            {isNew
              ? 'Set up your firm profile to start managing your team.'
              : 'Your firm profile and contact information.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Firm name"
            name="firmName"
            required
            value={form.firmName}
            onChange={(e) => update('firmName', e.target.value)}
            error={errors.firmName}
          />
          <Input
            label="Registration number"
            name="registrationNumber"
            value={form.registrationNumber}
            onChange={(e) => update('registrationNumber', e.target.value)}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Firm logo
            </span>
            <PhotoUpload
              shape="circle"
              category="firm_logo"
              value={form.logo}
              onChange={(url) => update('logo', url)}
            />
          </div>
          <Input
            label="Website"
            name="website"
            value={form.website}
            onChange={(e) => update('website', e.target.value)}
            placeholder="https://…"
          />
          <Input
            label="Established year"
            name="establishedYear"
            type="number"
            min="1800"
            value={form.establishedYear}
            onChange={(e) => update('establishedYear', e.target.value)}
          />
          <Input
            label="Total employees"
            name="totalEmployees"
            type="number"
            min="0"
            value={form.totalEmployees}
            onChange={(e) => update('totalEmployees', e.target.value)}
            hint="Includes support staff"
          />
          <Input
            label="Number of professionals"
            name="numberOfProfessionals"
            type="number"
            min="0"
            value={form.numberOfProfessionals}
            onChange={(e) =>
              update('numberOfProfessionals', e.target.value)
            }
            hint="Practising professionals in the firm"
          />
          <Combobox
            label="Headquarters"
            name="headquarters"
            value={headquartersCityId}
            onChange={(e) => {
              const row = cityById(e.target.value);
              update('headquarters', row ? row.name : '');
            }}
            options={cityOptions}
            placeholder="Select city…"
          />
          <Input
            label="Practice areas"
            name="practiceAreas"
            value={form.practiceAreas}
            onChange={(e) => update('practiceAreas', e.target.value)}
            hint="Comma-separated"
          />
          <Input
            label="Contact email"
            name="contactEmail"
            type="email"
            value={form.contactEmail}
            onChange={(e) => update('contactEmail', e.target.value)}
          />
          <Input
            label="Contact number"
            name="contactNumber"
            value={form.contactNumber}
            onChange={(e) => update('contactNumber', e.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="firm-about"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            About
          </label>
          <textarea
            id="firm-about"
            name="about"
            rows={4}
            value={form.about}
            onChange={(e) => update('about', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-800">Social links</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="LinkedIn"
              name="linkedin"
              value={form.linkedin}
              onChange={(e) => update('linkedin', e.target.value)}
              placeholder="https://linkedin.com/company/…"
            />
            <Input
              label="Twitter"
              name="twitter"
              value={form.twitter}
              onChange={(e) => update('twitter', e.target.value)}
              placeholder="https://twitter.com/…"
            />
            <Input
              label="Facebook"
              name="facebook"
              value={form.facebook}
              onChange={(e) => update('facebook', e.target.value)}
              placeholder="https://facebook.com/…"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-800">Documents</h3>
          <p className="mt-1 text-xs text-slate-500">
            Upload your firm&apos;s registration and compliance documents
            (images or PDF, up to 10 MB each).
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FileUpload
              label="Registration certificate"
              category="firm_registration"
              value={form.registrationCertificate}
              onChange={(url) => update('registrationCertificate', url)}
            />
            <FileUpload
              label="Business license"
              category="business_license"
              value={form.businessLicense}
              onChange={(url) => update('businessLicense', url)}
            />
          </div>

          {/* Tax documents — variable-length list */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">
                Tax documents
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTaxDoc}
              >
                <Plus className="h-3.5 w-3.5" />
                Add document
              </Button>
            </div>
            {form.taxDocuments.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No tax documents added.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {form.taxDocuments.map((docUrl, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex-1">
                      <FileUpload
                        category="tax_document"
                        value={docUrl}
                        onChange={(url) => updateTaxDoc(index, url)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTaxDoc(index)}
                      aria-label="Remove tax document"
                      className="mt-1 rounded-md border border-red-200 bg-white p-1.5 text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            {saving
              ? 'Saving…'
              : isNew
                ? 'Create law firm'
                : 'Save law firm details'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
