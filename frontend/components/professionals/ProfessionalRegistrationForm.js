'use client';

// ProfessionalRegistrationForm — the shared dynamic professional form used by
// both the signup page (full registration) and the application-status page
// (resubmission). It renders multi-section collapsible cards with a progress
// indicator, switches the Legal vs Tax section based on professionalType, and
// owns all field state. The parent supplies `mode` ('register' | 'resubmit'),
// optional `initialValues`, a `submitLabel`, an `onSubmit(payload)` callback,
// plus `submitting` / `banner` state.

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  Scale,
  Calculator,
  Edit3,
} from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Combobox from '@/components/common/Combobox';
import MultiCombobox from '@/components/common/MultiCombobox';
import FileUpload from '@/components/common/FileUpload';
import PhotoUpload from '@/components/common/PhotoUpload';
import Button from '@/components/common/Button';
import { isEmail, isPhone, isStrongPassword } from '@/utils/validators';
import { useCategories } from '@/hooks/useAppSettings';
import { useLocations } from '@/hooks/useLocations';
import ChangePhoneModal from '@/components/profile/ChangePhoneModal';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROFESSIONAL_TYPES = {
  LEGAL: 'Legal Consultant',
  TAX: 'Tax Consultant',
};

const CONSULTATION_TYPE_OPTIONS = [
  { value: 'Online', label: 'Online' },
  { value: 'In-person', label: 'In-person' },
  { value: 'Both', label: 'Both' },
];


// ---------------------------------------------------------------------------
// Empty form shape
// ---------------------------------------------------------------------------

function emptyValues() {
  return {
    // Personal
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
    country: '',
    state: '',
    city: '',
    addressLine: '',
    bio: '',
    profilePhoto: '',
    // Admin-managed taxonomy: array of selected SubCategory ids.
    subCategoryIds: [],
    // Admin-managed list: cities the professional actually practises in.
    practiceCities: [],
    // Professional details
    yearsOfExperience: '',
    skills: '',
    languages: '',
    education: '',
    certifications: '',
    website: '',
    linkedin: '',
    consultationFee: '',
    availability: '',
    // Common documents
    governmentId: '',
    resume: '',
    degreeCertificate: '',
    // Legal fields
    barRegistrationNumber: '',
    enrollmentNumber: '',
    advocateLicenseNumber: '',
    practiceAreas: '',
    courtPractice: '',
    jurisdiction: '',
    chamberAddress: '',
    lawDegree: '',
    legalConsultationType: '',
    yearsOfPractice: '',
    advocateLicense: '',
    barCouncilRegistration: '',
    practiceCertificate: '',
    lawDegreeDocument: '',
    supportingCertificates: [],
    // Tax fields
    taxRegistrationNumber: '',
    specializationAreas: '',
    taxConsultationType: '',
    taxConsultantCertificate: '',
    registrationCertificate: '',
    professionalLicense: '',
    supportingCertifications: [],
  };
}

// ---------------------------------------------------------------------------
// Comma-string <-> array helpers
// ---------------------------------------------------------------------------

/** Split a comma-separated string into a trimmed, de-empty'd array. */
function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Join an array into a comma-separated string for an input field. */
function toCsv(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  return '';
}

/**
 * Build a populated values object from API profile data. Accepts the loose
 * shape returned by GET /api/profile (user / professionalDetail / lawyerDetail
 * / techDetail and any nested professional / legal / tax detail objects).
 */
export function valuesFromProfile(data) {
  const v = emptyValues();
  if (!data || typeof data !== 'object') return v;

  const user = data.user || {};
  const address = data.address || user.address || {};
  const pro =
    data.professionalDetail ||
    data.professional ||
    data.professionalDetails ||
    {};
  const legal = data.lawyerDetail || data.legal || data.legalDetail || {};
  const tax = data.techDetail || data.tax || data.taxDetail || {};

  const pick = (...candidates) => {
    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== '') return c;
    }
    return '';
  };

  v.firstName = pick(user.firstName, data.firstName);
  v.lastName = pick(user.lastName, data.lastName);
  v.email = pick(user.email, data.email);
  v.mobileNumber = pick(user.mobileNumber, data.mobileNumber);
  v.country = pick(address.country, pro.country);
  v.state = pick(address.state, pro.state);
  v.city = pick(address.city, pro.city);
  v.subCategoryIds = Array.isArray(pro.subCategoryIds)
    ? pro.subCategoryIds.filter(Boolean)
    : [];
  v.practiceCities = Array.isArray(pro.practiceCities)
    ? pro.practiceCities.filter(Boolean)
    : [];
  v.addressLine = pick(address.addressLine, address.line1, pro.addressLine);
  v.bio = pick(pro.bio, user.bio);
  v.profilePhoto = pick(user.profilePhoto, pro.profilePhoto, data.profilePhoto);

  v.yearsOfExperience =
    pro.yearsOfExperience !== undefined && pro.yearsOfExperience !== null
      ? String(pro.yearsOfExperience)
      : '';
  v.skills = toCsv(pro.skills);
  v.expertise = toCsv(pro.expertise);
  v.languages = toCsv(pro.languages);
  v.education = toCsv(pro.education);
  v.certifications = toCsv(pro.certifications);
  v.website = pick(pro.website);
  v.linkedin = pick(pro.linkedin);
  v.consultationFee =
    pro.consultationFee !== undefined && pro.consultationFee !== null
      ? String(pro.consultationFee)
      : '';
  v.availability = toCsv(pro.availability);
  v.governmentId = pick(pro.governmentId);
  v.resume = pick(pro.resume);
  v.degreeCertificate = pick(pro.degreeCertificate);

  // Legal — promoted identifiers (bar/enrollment/license, chamber, courts,
  // consultation type) live on ProfessionalDetail. We prefer that source so
  // values typed at signup show up on /profile/edit, falling back to the
  // legacy LawyerDetail row when nothing's been migrated.
  v.barRegistrationNumber = pick(pro.barRegistrationNumber, legal.barRegistrationNumber);
  v.enrollmentNumber = pick(pro.enrollmentNumber, legal.enrollmentNumber);
  v.advocateLicenseNumber = pick(
    pro.licenseNumber,
    legal.advocateLicenseNumber,
    legal.licenseNumber
  );
  v.practiceAreas = toCsv(legal.practiceAreas);
  // Use whichever source has data — courtsPracticing on professionalDetail is
  // the modern home; legacy rows still have courtPractice on lawyerDetail.
  v.courtPractice =
    toCsv(pro.courtsPracticing) || toCsv(legal.courtPractice);
  v.jurisdiction = pick(legal.jurisdiction);
  v.chamberAddress = pick(pro.chamberAddress, legal.chamberAddress);
  v.lawDegree = pick(legal.lawDegree);
  v.legalConsultationType = pick(pro.consultancyType, legal.consultationType);
  v.yearsOfPractice =
    legal.yearsOfPractice !== undefined && legal.yearsOfPractice !== null
      ? String(legal.yearsOfPractice)
      : '';
  // Document URLs: ProfessionalDetail holds the canonical post-signup copy
  // (advocateLicenseDoc / barCouncilCertDoc / lawDegreeDoc), but legacy rows
  // keep them on LawyerDetail under different keys.
  v.advocateLicense = pick(pro.advocateLicenseDoc, legal.advocateLicense);
  v.barCouncilRegistration = pick(
    pro.barCouncilCertDoc,
    legal.barCouncilRegistration
  );
  v.practiceCertificate = pick(legal.practiceCertificate);
  v.lawDegreeDocument = pick(pro.lawDegreeDoc, legal.lawDegreeDocument);
  v.supportingCertificates = Array.isArray(legal.supportingCertificates)
    ? legal.supportingCertificates.filter(Boolean)
    : [];
  // Government ID lives on ProfessionalDetail post-signup.
  v.governmentId = pick(pro.governmentIdDoc, pro.governmentId);

  // Tax — same story: identifiers + docs are promoted to ProfessionalDetail.
  v.taxRegistrationNumber = pick(pro.taxRegistrationNumber, tax.taxRegistrationNumber);
  v.specializationAreas = toCsv(tax.specializationAreas);
  v.taxConsultationType = pick(pro.consultancyType, tax.consultationType);
  v.taxConsultantCertificate = pick(
    pro.taxRegistrationCertDoc,
    tax.taxConsultantCertificate
  );
  v.registrationCertificate = pick(
    pro.qualificationCertDoc,
    tax.registrationCertificate
  );
  v.professionalLicense = pick(
    pro.professionalLicenseDoc,
    tax.professionalLicense
  );
  v.supportingCertifications = Array.isArray(tax.supportingCertifications)
    ? tax.supportingCertifications.filter(Boolean)
    : [];

  return v;
}

/**
 * Build the API payload from the form values for a given professionalType.
 * `mode` 'register' includes credentials + role-detail nesting at the top
 * level; 'resubmit' wraps the professional detail under `professional`.
 */
export function buildPayload(values, professionalType, mode) {
  const isLegal = professionalType === PROFESSIONAL_TYPES.LEGAL;

  const professional = {
    yearsOfExperience: values.yearsOfExperience
      ? Number(values.yearsOfExperience)
      : undefined,
    skills: toArray(values.skills),
    languages: toArray(values.languages),
    education: toArray(values.education),
    certifications: toArray(values.certifications),
    website: values.website.trim(),
    linkedin: values.linkedin.trim(),
    consultationFee: values.consultationFee
      ? Number(values.consultationFee)
      : undefined,
    availability: toArray(values.availability),
    profilePhoto: values.profilePhoto || '',
    governmentId: values.governmentId || '',
    resume: values.resume || '',
    degreeCertificate: values.degreeCertificate || '',
    bio: values.bio.trim(),
    country: values.country.trim(),
    state: values.state.trim(),
    city: values.city.trim(),
    addressLine: values.addressLine.trim(),
    subCategoryIds: Array.isArray(values.subCategoryIds)
      ? values.subCategoryIds
      : [],
    practiceCities: Array.isArray(values.practiceCities)
      ? values.practiceCities.filter(Boolean)
      : [],
  };

  const legal = {
    barRegistrationNumber: values.barRegistrationNumber.trim(),
    enrollmentNumber: values.enrollmentNumber.trim(),
    advocateLicenseNumber: values.advocateLicenseNumber.trim(),
    practiceAreas: toArray(values.practiceAreas),
    courtPractice: toArray(values.courtPractice),
    jurisdiction: values.jurisdiction.trim(),
    chamberAddress: values.chamberAddress.trim(),
    lawDegree: values.lawDegree.trim(),
    consultationType: values.legalConsultationType || '',
    yearsOfPractice: values.yearsOfPractice
      ? Number(values.yearsOfPractice)
      : undefined,
    advocateLicense: values.advocateLicense || '',
    barCouncilRegistration: values.barCouncilRegistration || '',
    practiceCertificate: values.practiceCertificate || '',
    lawDegreeDocument: values.lawDegreeDocument || '',
    supportingCertificates: (values.supportingCertificates || []).filter(
      Boolean
    ),
  };

  const tax = {
    taxRegistrationNumber: values.taxRegistrationNumber.trim(),
    consultationType: values.taxConsultationType || '',
    taxConsultantCertificate: values.taxConsultantCertificate || '',
    registrationCertificate: values.registrationCertificate || '',
    professionalLicense: values.professionalLicense || '',
    supportingCertifications: (values.supportingCertifications || []).filter(
      Boolean
    ),
  };

  if (mode === 'resubmit') {
    const payload = { professionalType, professional };
    if (isLegal) payload.legal = legal;
    else payload.tax = tax;
    return payload;
  }

  // Edit mode — single flat payload split by the consumer into
  // PUT /api/profile (personal/address) + PUT /api/profile/professional
  // (everything else). Documents and identifiers come out at the top level
  // because the listing / admin / cards all read from ProfessionalDetail
  // top-level columns now.
  if (mode === 'edit') {
    return {
      // Identity
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      mobileNumber: values.mobileNumber.trim(),
      profilePhoto: values.profilePhoto || '',
      // Address
      country: values.country.trim(),
      state: values.state.trim(),
      city: values.city.trim(),
      addressLine: values.addressLine.trim(),
      // Professional core
      professionalType,
      primaryCategoryId: values.primaryCategoryId || null,
      subCategoryIds: Array.isArray(values.subCategoryIds)
        ? values.subCategoryIds
        : [],
      practiceCities: Array.isArray(values.practiceCities)
        ? values.practiceCities.filter(Boolean)
        : [],
      yearsOfExperience: values.yearsOfExperience
        ? Number(values.yearsOfExperience)
        : 0,
      consultationFee: values.consultationFee
        ? Number(values.consultationFee)
        : undefined,
      bio: values.bio.trim(),
      skills: toArray(values.skills),
      languages: toArray(values.languages),
      education: toArray(values.education),
      certifications: toArray(values.certifications),
      website: values.website.trim(),
      linkedin: values.linkedin.trim(),
      availability: toArray(values.availability),
      // Practice / identifiers (top-level on ProfessionalDetail)
      consultancyType: isLegal
        ? values.legalConsultationType || null
        : values.taxConsultationType || null,
      chamberAddress: values.chamberAddress.trim() || null,
      courtsPracticing: toArray(values.courtPractice),
      barRegistrationNumber: isLegal
        ? values.barRegistrationNumber.trim() || null
        : null,
      enrollmentNumber: isLegal
        ? values.enrollmentNumber.trim() || null
        : null,
      licenseNumber: isLegal
        ? values.advocateLicenseNumber.trim() || null
        : null,
      taxRegistrationNumber: isLegal
        ? null
        : values.taxRegistrationNumber.trim() || null,
      // Documents
      governmentIdDoc: values.governmentId || null,
      advocateLicenseDoc: isLegal ? values.advocateLicense || null : null,
      barCouncilCertDoc: isLegal
        ? values.barCouncilRegistration || null
        : null,
      lawDegreeDoc: isLegal ? values.lawDegreeDocument || null : null,
      taxRegistrationCertDoc: !isLegal
        ? values.taxConsultantCertificate || null
        : null,
      qualificationCertDoc: !isLegal
        ? values.registrationCertificate || null
        : null,
      professionalLicenseDoc: !isLegal
        ? values.professionalLicense || null
        : null,
      // Legacy lawyer/tax sub-objects for fields not promoted to top-level.
      lawyer: isLegal
        ? {
            practiceAreas: toArray(values.practiceAreas),
            jurisdiction: values.jurisdiction.trim(),
            lawDegree: values.lawDegree.trim(),
            availability: toArray(values.availability),
          }
        : undefined,
    };
  }

  // Registration: flat top-level professional payload.
  const payload = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    mobileNumber: values.mobileNumber.trim(),
    password: values.password,
    professionalType,
    ...professional,
  };
  if (isLegal) payload.legal = legal;
  else payload.tax = tax;
  return payload;
}

/**
 * Validate the form for a given professionalType / mode.
 * Returns a { field: message } errors object (empty when valid).
 */
export function validateValues(values, professionalType, mode) {
  const errors = {};
  const req = (field, message) => {
    if (!String(values[field] || '').trim()) errors[field] = message;
  };

  req('firstName', 'First name is required.');
  req('lastName', 'Last name is required.');

  if (mode === 'register') {
    if (!values.email.trim()) errors.email = 'Email is required.';
    else if (!isEmail(values.email))
      errors.email = 'Enter a valid email address.';
    if (!values.mobileNumber.trim())
      errors.mobileNumber = 'Mobile number is required.';
    else if (!isPhone(values.mobileNumber))
      errors.mobileNumber = 'Enter a valid 10-digit mobile number.';
    if (!values.password) errors.password = 'Password is required.';
    else if (!isStrongPassword(values.password))
      errors.password = 'Password must be at least 8 characters.';
    if (values.confirmPassword !== values.password)
      errors.confirmPassword = 'Passwords do not match.';
  }

  req('country', 'Country is required.');
  req('state', 'State is required.');
  req('city', 'City is required.');

  if (professionalType === PROFESSIONAL_TYPES.LEGAL) {
    req('barRegistrationNumber', 'Bar registration number is required.');
    req('enrollmentNumber', 'Enrollment number is required.');
    req('advocateLicenseNumber', 'Advocate license number is required.');
    req('jurisdiction', 'Jurisdiction is required.');
  } else if (professionalType === PROFESSIONAL_TYPES.TAX) {
    req('taxRegistrationNumber', 'Tax registration number is required.');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A collapsible section card with a step number badge. */
function SectionCard({ index, title, description, complete, children }) {
  const [open, setOpen] = useState(true);
  // Wizard chrome already shows step progress, so we only render the
  // numbered badge when the parent explicitly passes a non-null `index`.
  // Sections that pass `index={null}` (e.g. the type-specific Section 4)
  // render with no leading number.
  const showBadge = index !== null && index !== undefined;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        {showBadge && (
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
              complete
                ? 'bg-teal-100 text-teal-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {complete ? <CheckCircle2 size={16} /> : index}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            {title}
          </span>
          {description && (
            <span className="block text-xs text-slate-500">{description}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-5">{children}</div>
      )}
    </div>
  );
}

/** A multi-file add/remove list — array of stored URLs. */
function MultiFileList({ label, hint, category, value, onChange }) {
  const list = Array.isArray(value) ? value : [];
  return (
    <div className="w-full">
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <div className="space-y-3">
        {list.map((url, i) => (
          <div key={`${url}-${i}`} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <FileUpload
                value={url}
                category={category}
                onChange={(next) => {
                  const copy = [...list];
                  if (next) copy[i] = next;
                  else copy.splice(i, 1);
                  onChange(copy);
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const copy = [...list];
                copy.splice(i, 1);
                onChange(copy);
              }}
              className="mt-1 inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {/* An empty uploader to append a new file. */}
        <FileUpload
          value=""
          category={category}
          hint="Add another document"
          onChange={(next) => {
            if (next) onChange([...list, next]);
          }}
        />
      </div>
    </div>
  );
}

/** A simple labelled textarea matching the design system. */
function TextArea({ label, name, value, onChange, placeholder, error }) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={name}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={3}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 focus:border-amber-500 focus:ring-amber-200'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ProfessionalRegistrationForm
 * Props:
 *  - mode: 'register' | 'resubmit'
 *  - professionalType: 'Legal Consultant' | 'Tax Consultant'
 *  - initialValues: optional partial values to prefill
 *  - submitLabel: button text
 *  - submitting: boolean — disables the submit button + shows a spinner
 *  - banner: error banner text
 *  - serverErrors: { field: msg } map from a backend 422 response
 *  - onSubmit: (payload) => void
 */
export default function ProfessionalRegistrationForm({
  mode = 'register',
  professionalType,
  initialValues,
  submitLabel = 'Submit',
  submitting = false,
  banner = '',
  serverErrors,
  onSubmit,
  // Edit mode: optional async (payload, currentStep) => Promise — invoked
  // before advancing to the next step so the visitor's data is persisted
  // immediately instead of waiting for the final submit. If it rejects,
  // the step is NOT advanced and `banner` should be set by the parent.
  onStepSave,
  // Starting step number — used by the resume flow so a professional who
  // closed the tab after Step 1 lands directly on Step 2 instead of
  // re-doing Personal info.
  initialStep = 1,
  // When set, the Mobile number input is pre-filled and disabled. Used by
  // the phone-first signup wizard, which verifies the phone via OTP before
  // this form is ever shown.
  lockedMobileNumber = '',
}) {
  const [values, setValues] = useState(() => ({
    ...emptyValues(),
    ...(initialValues || {}),
    ...(lockedMobileNumber ? { mobileNumber: lockedMobileNumber } : {}),
  }));
  const [errors, setErrors] = useState({});
  // 3-step wizard: 1=Personal info, 2=Professional details, 3=Documents.
  const [step, setStep] = useState(initialStep);
  // In-flight indicator for the per-step save.
  const [stepSaving, setStepSaving] = useState(false);
  // Phone-change modal: only relevant in edit/resubmit modes. In register
  // mode the mobile is captured directly via the input (or locked via
  // `lockedMobileNumber` when the parent ran the phone-OTP wizard first).
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  const isLegal = professionalType === PROFESSIONAL_TYPES.LEGAL;

  // Admin-managed taxonomy + cities power the dropdowns.
  const { categories } = useCategories();
  const {
    countries,
    statesByCountry,
    citiesByState,
    flatCities,
    cityById,
    stateById,
    countryById,
  } = useLocations();

  // Resolve the IDs that drive the cascading Country/State/City Selects.
  // We mirror these IDs into `country/state/city` text fields below so the
  // existing buildPayload (which writes those text values into the address)
  // keeps working without a deeper rewrite.
  const selectedCountryId =
    countries.find((c) => c.name === values.country)?.id || '';
  const stateRows = statesByCountry(selectedCountryId);
  const selectedStateId =
    stateRows.find((s) => s.name === values.state)?.id || '';
  const cityRowsForState = citiesByState(selectedStateId);
  const selectedCityId =
    cityRowsForState.find((c) => c.name === values.city)?.id || '';

  function pickCountry(id) {
    const c = countryById(id);
    setValues((v) => ({
      ...v,
      country: c ? c.name : '',
      state: '',
      city: '',
    }));
    setErrors((er) => ({ ...er, country: undefined, state: undefined, city: undefined }));
  }
  function pickState(id) {
    const s = stateById(id);
    setValues((v) => ({ ...v, state: s ? s.name : '', city: '' }));
    setErrors((er) => ({ ...er, state: undefined, city: undefined }));
  }
  function pickCity(id) {
    const c = cityById(id);
    setValues((v) => ({ ...v, city: c ? c.name : '' }));
    setErrors((er) => ({ ...er, city: undefined }));
  }
  const categoryForType = useMemo(() => {
    if (!Array.isArray(categories)) return null;
    const target = isLegal ? 'legal' : 'tax';
    return categories.find((c) => String(c.slug || '').toLowerCase() === target);
  }, [categories, isLegal]);

  function toggleSubCategory(id) {
    setValues((v) => {
      const set = new Set(v.subCategoryIds || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...v, subCategoryIds: Array.from(set) };
    });
  }
  const allErrors = useMemo(
    () => ({ ...(serverErrors || {}), ...errors }),
    [serverErrors, errors]
  );

  function setField(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setField(name, type === 'checkbox' ? checked : value);
  }

  // Per-step validation: returns an error map for the fields the visible
  // step controls, so Next/Back can't bypass required values.
  function validateStep(targetStep) {
    const allErrs = validateValues(values, professionalType, mode);
    const STEP_FIELDS = {
      1: [
        'firstName',
        'lastName',
        'email',
        'mobileNumber',
        'password',
        'confirmPassword',
        'country',
        'state',
        'city',
      ],
      2: [
        'barRegistrationNumber',
        'enrollmentNumber',
        'advocateLicenseNumber',
        'jurisdiction',
        'taxRegistrationNumber',
      ],
      3: [],
    };
    const stepFields = STEP_FIELDS[targetStep] || [];
    const filtered = {};
    for (const k of stepFields) {
      if (allErrs[k]) filtered[k] = allErrs[k];
    }
    return filtered;
  }

  async function goNext() {
    const stepErrs = validateStep(step);
    if (Object.keys(stepErrs).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrs }));
      // Scroll to the first error so the inline message is visible.
      if (typeof window !== 'undefined') {
        const firstKey = Object.keys(stepErrs)[0];
        const el = document.querySelector(`[name="${firstKey}"]`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof el.focus === 'function') el.focus({ preventScroll: true });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
      return;
    }
    setErrors({});
    // Persist what we have for this step before advancing. The parent
    // controls how to split the payload across endpoints — we just hand
    // it the same `buildPayload` result the final submit would use.
    if (typeof onStepSave === 'function') {
      try {
        setStepSaving(true);
        const payload = buildPayload(values, professionalType, mode);
        await onStepSave(payload, step);
      } catch (err) {
        // Parent should surface the message via the `banner` prop. We
        // stay on the current step.
        setStepSaving(false);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      } finally {
        setStepSaving(false);
      }
    }
    setStep((s) => Math.min(3, s + 1));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validateValues(values, professionalType, mode);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Jump to the first step that has an error so the user sees what's
      // missing instead of staring at the disabled submit on step 3.
      const STEP_FIELDS = {
        1: [
          'firstName',
          'lastName',
          'email',
          'mobileNumber',
          'password',
          'confirmPassword',
          'country',
          'state',
          'city',
        ],
        2: [
          'barRegistrationNumber',
          'enrollmentNumber',
          'advocateLicenseNumber',
          'jurisdiction',
          'taxRegistrationNumber',
        ],
      };
      for (let s = 1; s <= 3; s += 1) {
        const fields = STEP_FIELDS[s] || [];
        if (fields.some((f) => errs[f])) {
          setStep(s);
          break;
        }
      }
      if (typeof window !== 'undefined')
        window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const payload = buildPayload(values, professionalType, mode);
    if (typeof onSubmit === 'function') onSubmit(payload);
  }

  // Step-based progress: 1 = Personal info, 2 = Professional details, 3 = Documents.
  const STEP_LABELS = ['Personal info', 'Professional details', 'Documents'];
  const stepProgress = Math.round((step / 3) * 100);

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Progress indicator — wizard chrome with one step visible at a time. */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-card">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
          <span>
            {isLegal ? (
              <span className="inline-flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-amber-600" />
                Legal Consultant / Advocate
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-amber-600" />
                Tax Consultant
              </span>
            )}
          </span>
          <span>Step {step} of 3 · {STEP_LABELS[step - 1]}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-teal-500 transition-all duration-300"
            style={{ width: `${stepProgress}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <span
                key={label}
                className={`inline-flex items-center gap-1.5 ${
                  active
                    ? 'font-semibold text-amber-700'
                    : done
                    ? 'text-emerald-600'
                    : 'text-slate-400'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    active
                      ? 'bg-amber-500 text-white'
                      : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? <CheckCircle2 size={12} /> : n}
                </span>
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {banner && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* Step 1 — Personal information */}
      {step === 1 && (
      <SectionCard
        index={1}
        title="Personal information"
        description="Tell us who you are."
        complete={false}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Profile photo
            </p>
            <PhotoUpload
              value={values.profilePhoto}
              onChange={(url) => setField('profilePhoto', url)}
              category="profile_photo"
              shape="circle"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              name="firstName"
              value={values.firstName}
              onChange={handleChange}
              placeholder="Aarav"
              required
              error={allErrors.firstName}
            />
            <Input
              label="Last name"
              name="lastName"
              value={values.lastName}
              onChange={handleChange}
              placeholder="Mehta"
              required
              error={allErrors.lastName}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Email address"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required={mode === 'register'}
              disabled={mode !== 'register'}
              error={allErrors.email}
            />
            <div>
              <Input
                label={
                  lockedMobileNumber
                    ? 'Mobile number (verified)'
                    : 'Mobile number'
                }
                name="mobileNumber"
                type="tel"
                value={values.mobileNumber}
                onChange={handleChange}
                placeholder="9876543210"
                required={mode === 'register'}
                disabled={mode !== 'register' || Boolean(lockedMobileNumber)}
                error={allErrors.mobileNumber}
              />
              {mode !== 'register' && (
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Changing your phone number requires verifying the new
                    number via OTP.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPhoneModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 transition hover:text-amber-800"
                  >
                    <Edit3 size={12} />
                    Change
                  </button>
                </div>
              )}
            </div>
          </div>
          {mode === 'register' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Password"
                name="password"
                type="password"
                value={values.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                required
                error={allErrors.password}
              />
              <Input
                label="Confirm password"
                name="confirmPassword"
                type="password"
                value={values.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                required
                error={allErrors.confirmPassword}
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Combobox
              label="Country"
              name="country"
              value={selectedCountryId}
              onChange={(e) => pickCountry(e.target.value)}
              options={countries.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select country…"
              required
              error={allErrors.country}
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
              required
              error={allErrors.state}
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
              required
              error={allErrors.city}
            />
          </div>
          <MultiCombobox
            label="Practice cities"
            name="practiceCities"
            value={values.practiceCities}
            onChange={(next) =>
              setValues((v) => ({ ...v, practiceCities: next }))
            }
            options={flatCities.map((c) => ({
              value: c.id,
              label: c.label,
            }))}
            placeholder="Select every city you take clients in…"
            hint="Searchable — choose from State — City. Clients filtering the listing by city will see you for any of these."
          />
          <Input
            label="Address line"
            name="addressLine"
            value={values.addressLine}
            onChange={handleChange}
            placeholder="Street, building, area"
            error={allErrors.addressLine}
          />
          <TextArea
            label="Short bio"
            name="bio"
            value={values.bio}
            onChange={handleChange}
            placeholder="A brief introduction about your practice."
            error={allErrors.bio}
          />

          {/* Admin-managed sub-categories filtered by Legal/Tax. Pick every
              area you practise in — drives search filters + profile tags. */}
          {categoryForType &&
            Array.isArray(categoryForType.subCategories) &&
            categoryForType.subCategories.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {categoryForType.name} sub-categories
                </label>
                <p className="mb-2 text-xs text-slate-500">
                  Select every {categoryForType.name.toLowerCase()} area you
                  practise in.
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoryForType.subCategories.map((s) => {
                    const checked = (values.subCategoryIds || []).includes(s.id);
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
                          checked={checked}
                          onChange={() => toggleSubCategory(s.id)}
                        />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      </SectionCard>
      )}

      {/* Step 2 — Professional details (includes type-specific identifiers) */}
      {step === 2 && (
      <SectionCard
        index={2}
        title="Professional details"
        description="Your experience, skills and availability."
        complete
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Years of experience"
              name="yearsOfExperience"
              type="number"
              min="0"
              value={values.yearsOfExperience}
              onChange={handleChange}
              placeholder="5"
              error={allErrors.yearsOfExperience}
            />
            <Input
              label="Consultation fee (₹)"
              name="consultationFee"
              type="number"
              min="0"
              value={values.consultationFee}
              onChange={handleChange}
              placeholder="1500"
              error={allErrors.consultationFee}
            />
          </div>
          <Input
            label="Skills"
            name="skills"
            value={values.skills}
            onChange={handleChange}
            placeholder="Litigation, Drafting, Negotiation"
            hint="Comma-separated"
            error={allErrors.skills}
          />
          <Input
            label="Languages"
            name="languages"
            value={values.languages}
            onChange={handleChange}
            placeholder="English, Hindi, Marathi"
            hint="Comma-separated"
            error={allErrors.languages}
          />
          <Input
            label="Education"
            name="education"
            value={values.education}
            onChange={handleChange}
            placeholder="LLB - Mumbai University, LLM - NLU"
            hint="Comma-separated"
            error={allErrors.education}
          />
          <Input
            label="Certifications"
            name="certifications"
            value={values.certifications}
            onChange={handleChange}
            placeholder="Certified Mediator, GST Practitioner"
            hint="Comma-separated"
            error={allErrors.certifications}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Website"
              name="website"
              value={values.website}
              onChange={handleChange}
              placeholder="https://example.com"
              error={allErrors.website}
            />
            <Input
              label="LinkedIn"
              name="linkedin"
              value={values.linkedin}
              onChange={handleChange}
              placeholder="https://linkedin.com/in/you"
              error={allErrors.linkedin}
            />
          </div>
          <Input
            label="Availability"
            name="availability"
            value={values.availability}
            onChange={handleChange}
            placeholder="Mon, Tue, Wed, Fri"
            hint="Comma-separated (e.g. days or time slots)"
            error={allErrors.availability}
          />
        </div>
      </SectionCard>
      )}

      {/* Step 3 — Documents upload (common docs only). Profession-specific
          docs are part of Section 4 below, which renders on both step 2
          (identifiers) and step 3 (documents) via an inner step gate. */}
      {step === 3 && (
      <SectionCard
        index={3}
        title="Documents"
        description="Upload identification and professional documents. All uploads are optional."
        complete
      >
        <div className="space-y-4">
          <FileUpload
            label="Government ID"
            value={values.governmentId}
            onChange={(url) => setField('governmentId', url)}
            category="identity_document"
            hint="Aadhaar, passport or other government-issued ID."
          />
          {isLegal ? (
            <>
              <FileUpload
                label="Advocate license"
                value={values.advocateLicense}
                onChange={(url) => setField('advocateLicense', url)}
                category="certification"
              />
              <FileUpload
                label="Bar council registration certificate"
                value={values.barCouncilRegistration}
                onChange={(url) =>
                  setField('barCouncilRegistration', url)
                }
                category="certification"
              />
              <FileUpload
                label="Law degree certificate"
                value={values.lawDegreeDocument}
                onChange={(url) => setField('lawDegreeDocument', url)}
                category="certification"
              />
            </>
          ) : (
            <>
              <FileUpload
                label="Tax registration certificate"
                value={values.taxConsultantCertificate}
                onChange={(url) =>
                  setField('taxConsultantCertificate', url)
                }
                category="certification"
              />
              <FileUpload
                label="Professional qualification certificate"
                value={values.registrationCertificate}
                onChange={(url) =>
                  setField('registrationCertificate', url)
                }
                category="certification"
              />
              <FileUpload
                label="Professional license"
                value={values.professionalLicense}
                onChange={(url) => setField('professionalLicense', url)}
                category="certification"
              />
            </>
          )}
        </div>
      </SectionCard>
      )}

      {/* Section 4 — Type-specific practice details. Only visible on Step 2;
          profession-specific documents have been consolidated into the
          single Documents section on Step 3. */}
      {step === 2 && (
      <SectionCard
        index={null}
        title={isLegal ? 'Legal practice details' : 'Tax practice details'}
        description={
          isLegal
            ? 'Registration numbers and practice information.'
            : 'Registration number and specializations.'
        }
        complete={false}
      >
        {isLegal ? (
          <div className="space-y-4">
            {step === 2 && (
            <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Bar registration number"
                name="barRegistrationNumber"
                value={values.barRegistrationNumber}
                onChange={handleChange}
                placeholder="MAH/1234/2020"
                required
                error={allErrors.barRegistrationNumber}
              />
              <Input
                label="Enrollment number"
                name="enrollmentNumber"
                value={values.enrollmentNumber}
                onChange={handleChange}
                placeholder="ENR-56789"
                required
                error={allErrors.enrollmentNumber}
              />
            </div>
            <Input
              label="Advocate license number"
              name="advocateLicenseNumber"
              value={values.advocateLicenseNumber}
              onChange={handleChange}
              placeholder="ADV-001122"
              required
              error={allErrors.advocateLicenseNumber}
            />
            {/* Practice areas are now covered by the admin-managed
                sub-categories multi-select above, so this field is no
                longer collected. */}
            <Input
              label="Courts you practice in"
              name="courtPractice"
              value={values.courtPractice}
              onChange={handleChange}
              placeholder="High Court, District Court"
              hint="Comma-separated"
              error={allErrors.courtPractice}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Jurisdiction"
                name="jurisdiction"
                value={values.jurisdiction}
                onChange={handleChange}
                placeholder="Maharashtra"
                required
                error={allErrors.jurisdiction}
              />
              <Input
                label="Law degree"
                name="lawDegree"
                value={values.lawDegree}
                onChange={handleChange}
                placeholder="LLB"
                error={allErrors.lawDegree}
              />
            </div>
            <Input
              label="Chamber address"
              name="chamberAddress"
              value={values.chamberAddress}
              onChange={handleChange}
              placeholder="Your chamber / office address"
              error={allErrors.chamberAddress}
            />
            <Select
              label="Consultation type"
              name="legalConsultationType"
              value={values.legalConsultationType}
              onChange={handleChange}
              options={CONSULTATION_TYPE_OPTIONS}
              placeholder="Select consultation type"
              error={allErrors.legalConsultationType}
            />

            </>
            )}

            {step === 3 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">
                Legal documents
              </p>
              <div className="space-y-4">
                <FileUpload
                  label="Advocate license"
                  value={values.advocateLicense}
                  onChange={(url) => setField('advocateLicense', url)}
                  category="certification"
                />
                <FileUpload
                  label="Bar council registration"
                  value={values.barCouncilRegistration}
                  onChange={(url) =>
                    setField('barCouncilRegistration', url)
                  }
                  category="certification"
                />
                <FileUpload
                  label="Practice certificate"
                  value={values.practiceCertificate}
                  onChange={(url) => setField('practiceCertificate', url)}
                  category="certification"
                />
                <FileUpload
                  label="Law degree document"
                  value={values.lawDegreeDocument}
                  onChange={(url) => setField('lawDegreeDocument', url)}
                  category="certification"
                />
                <MultiFileList
                  label="Supporting certificates"
                  hint="Add any additional certificates."
                  category="certification"
                  value={values.supportingCertificates}
                  onChange={(list) =>
                    setField('supportingCertificates', list)
                  }
                />
              </div>
            </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {step === 2 && (
            <>
            <Input
              label="Tax registration number"
              name="taxRegistrationNumber"
              value={values.taxRegistrationNumber}
              onChange={handleChange}
              placeholder="TRN-99887766"
              required
              error={allErrors.taxRegistrationNumber}
            />
            {/* Expertise is now driven by the admin-managed sub-categories
                multi-select at the top of the form — those are the
                professional's expertise areas, so the separate flag list has
                been removed. */}
            <Select
              label="Consultation type"
              name="taxConsultationType"
              value={values.taxConsultationType}
              onChange={handleChange}
              options={CONSULTATION_TYPE_OPTIONS}
              placeholder="Select consultation type"
              error={allErrors.taxConsultationType}
            />

            </>
            )}

            {step === 3 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">
                Tax documents
              </p>
              <div className="space-y-4">
                <FileUpload
                  label="Tax consultant certificate"
                  value={values.taxConsultantCertificate}
                  onChange={(url) =>
                    setField('taxConsultantCertificate', url)
                  }
                  category="certification"
                />
                <FileUpload
                  label="Registration certificate"
                  value={values.registrationCertificate}
                  onChange={(url) =>
                    setField('registrationCertificate', url)
                  }
                  category="certification"
                />
                <FileUpload
                  label="Professional license"
                  value={values.professionalLicense}
                  onChange={(url) => setField('professionalLicense', url)}
                  category="certification"
                />
                <MultiFileList
                  label="Supporting certifications"
                  hint="Add any additional certifications."
                  category="certification"
                  value={values.supportingCertifications}
                  onChange={(list) =>
                    setField('supportingCertifications', list)
                  }
                />
              </div>
            </div>
            )}
          </div>
        )}
      </SectionCard>
      )}

      {/* Wizard navigation — Back / Next / Submit. Submit only fires on step 3. */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={stepSaving || submitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {stepSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>Save &amp; continue →</>
            )}
          </button>
        ) : (
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          submitLabel
        )}
      </button>
        )}
      </div>

    </form>

    {/* Phone-change OTP modal — rendered as a SIBLING of <form>, not a
        descendant. Even if the React Portal somehow doesn't apply at
        runtime, the modal's own <form onSubmit={...}> won't collide with
        the wizard's outer <form onSubmit={handleSubmit}>. */}
    {mode !== 'register' && (
      <ChangePhoneModal
        open={phoneModalOpen}
        currentPhone={values.mobileNumber}
        onClose={() => setPhoneModalOpen(false)}
        onChanged={(newPhone) => {
          setField('mobileNumber', newPhone);
          setPhoneModalOpen(false);
        }}
      />
    )}
    </>
  );
}
