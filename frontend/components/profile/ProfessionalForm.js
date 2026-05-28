'use client';

// ProfessionalForm — edits professional details for `professional` and
// `firm_professional` roles. Shows a Lawyer or Tech Consultant sub-form
// depending on the selected professionalType. Saves via
// PUT /api/profile/professional.

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import MultiCombobox from '@/components/common/MultiCombobox';
import Button from '@/components/common/Button';
import FileUpload from '@/components/common/FileUpload';
import { updateProfessionalDetails } from '@/services/profileService';
import { useCategories } from '@/hooks/useAppSettings';
import { useLocations } from '@/hooks/useLocations';

const PROFESSIONAL_TYPES = [
  { value: 'Lawyer', label: 'Lawyer' },
  { value: 'Tech Consultant', label: 'Tech Consultant' },
  { value: 'Tax Consultant', label: 'Tax Consultant' },
  { value: 'Business Consultant', label: 'Business Consultant' },
  { value: 'CA', label: 'CA' },
  { value: 'Other', label: 'Other' },
];

// Comma-separated string -> trimmed, de-empt array.
function toArray(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Array -> comma-separated string (for prefilling text inputs).
function toCsv(arr) {
  if (!Array.isArray(arr)) return '';
  return arr
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.name || item.title || item.label || '';
      }
      return String(item);
    })
    .filter(Boolean)
    .join(', ');
}

// Best-effort: derive a category slug ('legal' / 'tax' / '') from the
// professionalType string when primaryCategoryId hasn't been resolved yet.
function inferCategoryFromType(professionalType) {
  const t = String(professionalType || '').toLowerCase();
  if (!t) return '';
  if (/(lawyer|advocate|legal|attorney|llb|barrister)/.test(t)) return 'legal';
  if (/(tax|ca|chartered accountant|gst|income tax)/.test(t)) return 'tax';
  return '';
}

function buildInitialState(detail, lawyer, tech) {
  const d = detail || {};
  const l = lawyer || {};
  const t = tech || {};
  // Prefer the unified top-level value from ProfessionalDetail (new 3-step
  // signup writes here), fall back to the legacy lawyer/tech sub-detail.
  const pick = (...candidates) => {
    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== '') return c;
    }
    return '';
  };
  return {
    professionalType: d.professionalType || 'Lawyer',
    // The new top-level primary category id (FK to `categories.id`). When
    // missing on legacy rows we hydrate it from the categories hook below.
    primaryCategoryId: d.primaryCategoryId || '',
    designation: d.designation || '',
    organization: d.organization || '',
    yearsOfExperience:
      d.yearsOfExperience === 0 || d.yearsOfExperience
        ? String(d.yearsOfExperience)
        : '',
    consultationFee:
      d.consultationFee === 0 || d.consultationFee
        ? String(d.consultationFee)
        : l.consultationFee
          ? String(l.consultationFee)
          : t.consultationFee
            ? String(t.consultationFee)
            : '',
    bio: d.bio || '',
    about: d.about || '',
    skills: toCsv(d.skills),
    languages: toCsv(d.languages),
    subCategoryIds: Array.isArray(d.subCategoryIds)
      ? d.subCategoryIds.filter(Boolean)
      : [],
    practiceCities: Array.isArray(d.practiceCities)
      ? d.practiceCities.filter(Boolean)
      : [],
    certifications: toCsv(d.certifications),
    education: toCsv(d.education),
    achievements: toCsv(d.achievements),
    website: d.website || '',
    linkedin: d.linkedin || '',
    profileResume: d.profileResume || '',
    licenseDocument: d.licenseDocument || '',
    identityDocument: d.identityDocument || '',
    certificationsDocuments: Array.isArray(d.certificationsDocuments)
      ? d.certificationsDocuments.filter(Boolean)
      : [],
    // --- Unified top-level identifiers / practice fields ---
    barRegistrationNumber: pick(d.barRegistrationNumber, l.barRegistrationNumber),
    enrollmentNumber: pick(d.enrollmentNumber, l.enrollmentNumber),
    licenseNumber: pick(d.licenseNumber, l.licenseNumber),
    taxRegistrationNumber: pick(d.taxRegistrationNumber),
    chamberAddress: pick(d.chamberAddress, l.chamberAddress),
    consultancyType: d.consultancyType || '',
    courtsPracticing: toCsv(
      Array.isArray(d.courtsPracticing) && d.courtsPracticing.length
        ? d.courtsPracticing
        : l.courtPractice
    ),
    // --- Unified top-level documents ---
    advocateLicenseDoc: pick(d.advocateLicenseDoc, l.advocateLicense),
    barCouncilCertDoc: pick(d.barCouncilCertDoc, l.barCertificate),
    lawDegreeDoc: pick(d.lawDegreeDoc, l.lawDegreeDocument),
    taxRegistrationCertDoc: pick(d.taxRegistrationCertDoc, t.taxConsultantCertificate),
    qualificationCertDoc: pick(d.qualificationCertDoc),
    professionalLicenseDoc: pick(d.professionalLicenseDoc, t.professionalLicense),
    governmentIdDoc: pick(d.governmentIdDoc, d.identityDocument),
    // --- Lawyer-only legacy fields kept for back-compat ---
    practiceAreas: toCsv(l.practiceAreas),
    jurisdiction: l.jurisdiction || '',
    lawDegree: l.lawDegree || '',
    availability: toCsv(l.availability),
    // --- Tech sub-form (untouched) ---
    technologies: toCsv(t.technologies),
    githubProfile: t.githubProfile || '',
    portfolioUrl: t.portfolioUrl || '',
    techCertifications: toCsv(t.certifications),
    experienceProjects: toCsv(t.experienceProjects),
  };
}

/**
 * ProfessionalForm
 * Props:
 *  - professionalDetail, lawyerDetail, techDetail: prefill data
 *  - onSaved: (refreshedProfile) => void
 *  - view: 'all' | 'professional' | 'documents' — drives which sections
 *          render. 'professional' hides the Documents block, 'documents'
 *          shows only the Documents block. Default 'all' is the legacy
 *          single-form layout.
 */
export default function ProfessionalForm({
  professionalDetail,
  lawyerDetail,
  techDetail,
  onSaved,
  view = 'all',
}) {
  const [form, setForm] = useState(() =>
    buildInitialState(professionalDetail, lawyerDetail, techDetail)
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const { categories } = useCategories();
  const { flatCities, cityById } = useLocations();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleSubCategory(id) {
    setForm((f) => {
      const set = new Set(f.subCategoryIds || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, subCategoryIds: Array.from(set) };
    });
  }

  // ---- certification documents (array of URL strings) ----------------------
  function addCertificationDoc() {
    setForm((f) => ({
      ...f,
      certificationsDocuments: [...f.certificationsDocuments, ''],
    }));
  }

  function updateCertificationDoc(index, url) {
    setForm((f) => {
      const next = [...f.certificationsDocuments];
      next[index] = url;
      return { ...f, certificationsDocuments: next };
    });
  }

  function removeCertificationDoc(index) {
    setForm((f) => ({
      ...f,
      certificationsDocuments: f.certificationsDocuments.filter(
        (_, i) => i !== index
      ),
    }));
  }

  // Hydrate primaryCategoryId on first render once the categories list
  // arrives: if the row was stored without it (legacy account) infer the
  // slug from professionalType and look up the matching category. Runs once
  // per categories-array reference, never overwrites an explicit value.
  useEffect(() => {
    if (form.primaryCategoryId || !Array.isArray(categories) || categories.length === 0) {
      return;
    }
    const slug = inferCategoryFromType(form.professionalType);
    if (!slug) return;
    const match = categories.find(
      (c) => String(c.slug || '').toLowerCase() === slug
    );
    if (match) {
      setForm((f) => ({ ...f, primaryCategoryId: match.id }));
    }
  }, [categories, form.primaryCategoryId, form.professionalType]);

  // Primary category drives which profession-specific fields are visible.
  // Priority: explicit primaryCategoryId on the row -> the category slug
  // looked up from the cached categories list -> fallback inferred from
  // professionalType. This makes the conditional logic match the new
  // 3-step signup wizard (which writes primaryCategoryId).
  const categoryById = new Map(
    (categories || []).map((c) => [c.id, String(c.slug || '').toLowerCase()])
  );
  const primaryCategorySlug =
    categoryById.get(form.primaryCategoryId) ||
    inferCategoryFromType(form.professionalType);
  const isLegal = primaryCategorySlug === 'legal';
  const isTax = primaryCategorySlug === 'tax';
  // Tech is kept for legacy back-compat; the new signup wizard never
  // selects it, so it only matters on older accounts.
  const isTech = form.professionalType === 'Tech Consultant';
  // Legacy alias used by some downstream JSX expressions.
  const isLawyer = isLegal;

  function validate() {
    const next = {};
    if (!form.professionalType)
      next.professionalType = 'Select a professional type.';
    if (!form.designation.trim())
      next.designation = 'Designation is required.';
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
        professionalType: form.professionalType,
        designation: form.designation.trim(),
        organization: form.organization.trim(),
        yearsOfExperience: form.yearsOfExperience
          ? Number(form.yearsOfExperience)
          : 0,
        consultationFee: form.consultationFee
          ? Number(form.consultationFee)
          : 0,
        bio: form.bio.trim(),
        about: form.about.trim(),
        skills: toArray(form.skills),
        languages: toArray(form.languages),
        certifications: toArray(form.certifications),
        education: toArray(form.education),
        achievements: toArray(form.achievements),
        website: form.website.trim(),
        linkedin: form.linkedin.trim(),
        profileResume: form.profileResume.trim() || undefined,
        licenseDocument: form.licenseDocument.trim() || undefined,
        identityDocument: form.identityDocument.trim() || undefined,
        certificationsDocuments: form.certificationsDocuments
          .map((url) => (url || '').trim())
          .filter(Boolean),
        subCategoryIds: Array.isArray(form.subCategoryIds)
          ? form.subCategoryIds
          : [],
        practiceCities: Array.isArray(form.practiceCities)
          ? form.practiceCities.filter(Boolean)
          : [],
        // --- Unified top-level identifiers / practice fields ---
        primaryCategoryId: form.primaryCategoryId || null,
        barRegistrationNumber: form.barRegistrationNumber.trim() || null,
        enrollmentNumber: form.enrollmentNumber.trim() || null,
        licenseNumber: form.licenseNumber.trim() || null,
        taxRegistrationNumber: form.taxRegistrationNumber.trim() || null,
        chamberAddress: form.chamberAddress.trim() || null,
        consultancyType: form.consultancyType || null,
        courtsPracticing: toArray(form.courtsPracticing),
        // --- Unified top-level documents ---
        advocateLicenseDoc: form.advocateLicenseDoc || null,
        barCouncilCertDoc: form.barCouncilCertDoc || null,
        lawDegreeDoc: form.lawDegreeDoc || null,
        taxRegistrationCertDoc: form.taxRegistrationCertDoc || null,
        qualificationCertDoc: form.qualificationCertDoc || null,
        professionalLicenseDoc: form.professionalLicenseDoc || null,
        governmentIdDoc: form.governmentIdDoc || null,
      };

      // The legacy lawyer/tech sub-objects are kept ONLY for fields that
      // haven't been promoted to the top-level (practice areas, law degree,
      // tech specifics). New unified fields are written above.
      if (isLawyer) {
        payload.lawyer = {
          practiceAreas: toArray(form.practiceAreas),
          jurisdiction: form.jurisdiction.trim(),
          lawDegree: form.lawDegree.trim(),
          availability: toArray(form.availability),
        };
      } else if (isTech) {
        payload.tech = {
          technologies: toArray(form.technologies),
          githubProfile: form.githubProfile.trim(),
          portfolioUrl: form.portfolioUrl.trim(),
          certifications: toArray(form.techCertifications),
          experienceProjects: toArray(form.experienceProjects),
        };
      }

      const refreshed = await updateProfessionalDetails(payload);
      setFeedback({
        type: 'success',
        message: 'Professional details saved.',
      });
      if (typeof onSaved === 'function') await onSaved(refreshed);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Could not save your professional details.',
      });
    } finally {
      setSaving(false);
    }
  }

  // Read-only verification + completion summary surfaced from
  // ProfessionalDetail so the professional sees their application status at
  // a glance. Editable fields below feed into completionPercent on save.
  const verificationStatus = (
    (professionalDetail && professionalDetail.verificationStatus) ||
    'pending'
  ).toLowerCase();
  const verificationLabel = (() => {
    if (verificationStatus === 'verified' || verificationStatus === 'approved')
      return { text: 'Verified', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
    if (verificationStatus === 'under_review')
      return { text: 'Under review', cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
    if (verificationStatus === 'rejected')
      return { text: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-200' };
    return { text: 'Pending', cls: 'bg-slate-50 text-slate-700 ring-slate-200' };
  })();
  const completionPercent =
    (professionalDetail && professionalDetail.completionPercent) || 0;

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Professional details
            </h2>
            <p className="text-sm text-slate-500">
              Your expertise, experience and credentials.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset ${verificationLabel.cls}`}
            >
              {verificationLabel.text}
            </span>
            <div className="flex w-44 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="font-medium text-slate-600">
                {completionPercent}%
              </span>
            </div>
          </div>
        </div>

        {view !== 'documents' && (
        <>
        {/* Admin-managed taxonomy: professionals can pick multiple
            sub-categories that drive their listing + search filter tags. */}
        <MultiCombobox
          label="Practice cities"
          name="practiceCities"
          value={(form.practiceCities || []).map((v) => {
            // Older rows may still hold a plain city name; resolve to id
            // so the chip renders 'State — City' regardless of source.
            if (cityById(v)) return v;
            const match = flatCities.find(
              (c) => c.name.toLowerCase() === String(v).toLowerCase()
            );
            return match ? match.id : v;
          })}
          onChange={(next) => update('practiceCities', next)}
          options={flatCities.map((c) => ({ value: c.id, label: c.label }))}
          placeholder="Select every city you take clients in…"
          hint="Searchable — choose from State — City. Clients filtering the listing by city will see you for any of these."
        />

        {/* Primary category — drives which profession-specific fields show
            up below (same Legal vs Tax conditional layout as the signup
            wizard's Step 2). */}
        {categories.length > 0 && (
          <Select
            label="Primary category"
            name="primaryCategoryId"
            value={form.primaryCategoryId || ''}
            onChange={(e) => update('primaryCategoryId', e.target.value)}
            options={[
              { value: '', label: 'Select category…' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            hint="Choose Legal or Tax to reveal the profession-specific identifier and document fields."
          />
        )}

        {categories.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Categories & sub-categories
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Pick every area you practise in — these power search filters and
              the badges on your profile.
            </p>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {cat.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(cat.subCategories || []).map((s) => {
                      const checked =
                        form.subCategoryIds &&
                        form.subCategoryIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                            checked
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={!!checked}
                            onChange={() => toggleSubCategory(s.id)}
                          />
                          {s.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Professional type"
            name="professionalType"
            required
            value={form.professionalType}
            onChange={(e) => update('professionalType', e.target.value)}
            options={PROFESSIONAL_TYPES}
            error={errors.professionalType}
          />
          <Input
            label="Designation"
            name="designation"
            required
            value={form.designation}
            onChange={(e) => update('designation', e.target.value)}
            error={errors.designation}
          />
          <Input
            label="Organization"
            name="organization"
            value={form.organization}
            onChange={(e) => update('organization', e.target.value)}
          />
          <Input
            label="Years of experience"
            name="yearsOfExperience"
            type="number"
            min="0"
            value={form.yearsOfExperience}
            onChange={(e) => update('yearsOfExperience', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label
              htmlFor="bio"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Short bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={2}
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label
              htmlFor="about"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              About
            </label>
            <textarea
              id="about"
              name="about"
              rows={4}
              value={form.about}
              onChange={(e) => update('about', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Skills"
            name="skills"
            value={form.skills}
            onChange={(e) => update('skills', e.target.value)}
            hint="Comma-separated, e.g. Negotiation, Drafting"
          />
          <Input
            label="Languages"
            name="languages"
            value={form.languages}
            onChange={(e) => update('languages', e.target.value)}
            hint="Comma-separated, e.g. English, Hindi"
          />
          <Input
            label="Certifications"
            name="certifications"
            value={form.certifications}
            onChange={(e) => update('certifications', e.target.value)}
            hint="Comma-separated"
          />
          <Input
            label="Education"
            name="education"
            value={form.education}
            onChange={(e) => update('education', e.target.value)}
            hint="Comma-separated"
          />
          <Input
            label="Achievements"
            name="achievements"
            value={form.achievements}
            onChange={(e) => update('achievements', e.target.value)}
            hint="Comma-separated"
          />
          <Input
            label="Website"
            name="website"
            value={form.website}
            onChange={(e) => update('website', e.target.value)}
            placeholder="https://…"
          />
          <Input
            label="LinkedIn"
            name="linkedin"
            value={form.linkedin}
            onChange={(e) => update('linkedin', e.target.value)}
            placeholder="https://linkedin.com/in/…"
          />
        </div>

        {/* Practice details — shared between Legal & Tax. Identifiers live
            top-level on professional_details so the listing + admin review
            read from one place. */}
        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-800">
            Practice details
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Consultation fee (₹ / minute)"
              name="consultationFee"
              type="number"
              min="0"
              value={form.consultationFee}
              onChange={(e) => update('consultationFee', e.target.value)}
            />
            <Select
              label="Consultancy type"
              name="consultancyType"
              value={form.consultancyType}
              onChange={(e) => update('consultancyType', e.target.value)}
              options={[
                { value: '', label: 'Select consultancy type…' },
                { value: 'online', label: 'Online' },
                { value: 'in_person', label: 'In Person' },
                { value: 'both', label: 'Both' },
              ]}
            />
            {isLawyer && (
              <>
                <Input
                  label="Bar registration number"
                  name="barRegistrationNumber"
                  value={form.barRegistrationNumber}
                  onChange={(e) =>
                    update('barRegistrationNumber', e.target.value)
                  }
                />
                <Input
                  label="Enrollment number"
                  name="enrollmentNumber"
                  value={form.enrollmentNumber}
                  onChange={(e) => update('enrollmentNumber', e.target.value)}
                />
                <Input
                  label="Advocate license number"
                  name="licenseNumber"
                  value={form.licenseNumber}
                  onChange={(e) => update('licenseNumber', e.target.value)}
                />
                <Input
                  label="Jurisdiction"
                  name="jurisdiction"
                  value={form.jurisdiction}
                  onChange={(e) => update('jurisdiction', e.target.value)}
                />
                <Input
                  label="Practice areas"
                  name="practiceAreas"
                  value={form.practiceAreas}
                  onChange={(e) => update('practiceAreas', e.target.value)}
                  hint="Comma-separated"
                />
                <Input
                  label="Law degree"
                  name="lawDegree"
                  value={form.lawDegree}
                  onChange={(e) => update('lawDegree', e.target.value)}
                />
              </>
            )}
            {isTax && (
              <>
                <Input
                  label="Tax registration number"
                  name="taxRegistrationNumber"
                  value={form.taxRegistrationNumber}
                  onChange={(e) =>
                    update('taxRegistrationNumber', e.target.value)
                  }
                />
                <Input
                  label="Enrollment number"
                  name="enrollmentNumber"
                  value={form.enrollmentNumber}
                  onChange={(e) => update('enrollmentNumber', e.target.value)}
                />
                <Input
                  label="License number"
                  name="licenseNumber"
                  value={form.licenseNumber}
                  onChange={(e) => update('licenseNumber', e.target.value)}
                />
              </>
            )}
            <Input
              label="Courts practising"
              name="courtsPracticing"
              value={form.courtsPracticing}
              onChange={(e) => update('courtsPracticing', e.target.value)}
              hint="Comma-separated, e.g. High Court, District Court"
              className="sm:col-span-2"
            />
            <Input
              label="Chamber address"
              name="chamberAddress"
              value={form.chamberAddress}
              onChange={(e) => update('chamberAddress', e.target.value)}
              className="sm:col-span-2"
            />
            {isLawyer && (
              <Input
                label="Availability"
                name="availability"
                value={form.availability}
                onChange={(e) => update('availability', e.target.value)}
                hint="Comma-separated, e.g. Mon, Tue, Wed"
                className="sm:col-span-2"
              />
            )}
          </div>
        </div>

        </>
        )}

        {view !== 'professional' && (
        <>
        {/* Documents — top-level URLs uploaded via the FileUpload widget.
            Profession-specific docs appear conditionally. */}
        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-800">Documents</h3>
          <p className="mt-1 text-xs text-slate-500">
            Government ID is mandatory. Profession-specific documents are
            required for verification — upload the highest-quality copies you
            have.
          </p>
          <div className="mt-3 space-y-3">
            <FileUpload
              label="Government ID (Aadhaar / passport)"
              value={form.governmentIdDoc}
              onChange={(url) => update('governmentIdDoc', url)}
              category="identity_document"
            />
            {isLawyer && (
              <>
                <FileUpload
                  label="Advocate license"
                  value={form.advocateLicenseDoc}
                  onChange={(url) => update('advocateLicenseDoc', url)}
                  category="certification"
                />
                <FileUpload
                  label="Bar council registration certificate"
                  value={form.barCouncilCertDoc}
                  onChange={(url) => update('barCouncilCertDoc', url)}
                  category="certification"
                />
                <FileUpload
                  label="Law degree certificate"
                  value={form.lawDegreeDoc}
                  onChange={(url) => update('lawDegreeDoc', url)}
                  category="certification"
                />
              </>
            )}
            {isTax && (
              <>
                <FileUpload
                  label="Tax registration certificate"
                  value={form.taxRegistrationCertDoc}
                  onChange={(url) => update('taxRegistrationCertDoc', url)}
                  category="certification"
                />
                <FileUpload
                  label="Professional qualification certificate"
                  value={form.qualificationCertDoc}
                  onChange={(url) => update('qualificationCertDoc', url)}
                  category="certification"
                />
                <FileUpload
                  label="Professional license"
                  value={form.professionalLicenseDoc}
                  onChange={(url) => update('professionalLicenseDoc', url)}
                  category="certification"
                />
              </>
            )}
          </div>
        </div>
        </>
        )}

        {view !== 'documents' && (
        <>
        {/* Tech Consultant sub-form */}
        {isTech && (
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-800">
              Tech consultant details
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Technologies"
                name="technologies"
                value={form.technologies}
                onChange={(e) => update('technologies', e.target.value)}
                hint="Comma-separated"
              />
              <Input
                label="GitHub profile"
                name="githubProfile"
                value={form.githubProfile}
                onChange={(e) => update('githubProfile', e.target.value)}
                placeholder="https://github.com/…"
              />
              <Input
                label="Portfolio URL"
                name="portfolioUrl"
                value={form.portfolioUrl}
                onChange={(e) => update('portfolioUrl', e.target.value)}
                placeholder="https://…"
              />
              <Input
                label="Certifications"
                name="techCertifications"
                value={form.techCertifications}
                onChange={(e) => update('techCertifications', e.target.value)}
                hint="Comma-separated"
              />
              <Input
                label="Experience projects"
                name="experienceProjects"
                value={form.experienceProjects}
                onChange={(e) => update('experienceProjects', e.target.value)}
                hint="Comma-separated"
              />
              <Input
                label="Consultation fee"
                name="techConsultationFee"
                type="number"
                min="0"
                value={form.techConsultationFee}
                onChange={(e) => update('techConsultationFee', e.target.value)}
              />
            </div>
          </div>
        )}
        </>
        )}

        {view !== 'professional' && (
        <>
        {/* Documents */}
        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-800">
            Additional documents
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Upload your resume and supporting documents (images or PDF, up to
            10 MB each).
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FileUpload
              label="Profile resume"
              category="resume"
              value={form.profileResume}
              onChange={(url) => update('profileResume', url)}
            />
            <FileUpload
              label="License document"
              category="license_document"
              value={form.licenseDocument}
              onChange={(url) => update('licenseDocument', url)}
            />
            <div className="sm:col-span-2">
              <FileUpload
                label="Identity document"
                category="identity_document"
                value={form.identityDocument}
                onChange={(url) => update('identityDocument', url)}
              />
            </div>
          </div>

          {/* Certification documents — variable-length list */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">
                Certification documents
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCertificationDoc}
              >
                <Plus className="h-3.5 w-3.5" />
                Add document
              </Button>
            </div>
            {form.certificationsDocuments.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No certification documents added.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {form.certificationsDocuments.map((docUrl, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex-1">
                      <FileUpload
                        category="certification"
                        value={docUrl}
                        onChange={(url) =>
                          updateCertificationDoc(index, url)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCertificationDoc(index)}
                      aria-label="Remove certification document"
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
        </>
        )}

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
            {saving ? 'Saving…' : 'Save professional details'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
