'use client';

// Admin — professional review detail.
// Auth-guarded and admin-only (platform_admin). Shows the full applicant
// profile for review and exposes approve / reject / request-info actions.

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Check,
  X,
  MessageSquare,
  FileText,
  User,
  MapPin,
  Briefcase,
  Scale,
  Calculator,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import DocumentPreviewModal from '@/components/common/DocumentPreviewModal';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import { formatDate, getInitials } from '@/utils/formatters';
import { resolveFileUrl } from '@/services/fileService';
import {
  getProfessionalReview,
  approveProfessional,
  rejectProfessional,
  requestProfessionalInfo,
} from '@/services/adminService';

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

/** Build a display name from a user object. */
function userName(user) {
  if (!user) return 'Unknown applicant';
  if (user.fullName) return user.fullName;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : user.email || 'Unknown applicant';
}

/** Section wrapper with an icon heading. */
function Section({ icon, title, children }) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

/** A single label/value pair. Renders nothing when the value is empty. */
function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800 break-words">{value}</dd>
    </div>
  );
}

/** A boolean field rendered as a Yes / No tick row. */
function BoolField({ label, value }) {
  if (value === null || value === undefined) return null;
  const yes = value === true || value === 'true' || value === 1;
  return (
    <div className="flex items-center gap-2">
      {yes ? (
        <CheckCircle2 size={16} className="text-emerald-600" />
      ) : (
        <XCircle size={16} className="text-slate-300" />
      )}
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  );
}

/** Chip list rendered from an array or comma-separated string. */
function ChipList({ label, value }) {
  let items = [];
  if (Array.isArray(value)) {
    items = value.filter(Boolean);
  } else if (typeof value === 'string' && value.trim()) {
    items = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (items.length === 0) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
          >
            {item}
          </span>
        ))}
      </dd>
    </div>
  );
}

/** Status → { label, variant } for the approval status badge. */
function statusBadge(status) {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', variant: 'green' };
    case 'REJECTED':
      return { label: 'Rejected', variant: 'red' };
    case 'INFO_REQUESTED':
      return { label: 'Information requested', variant: 'blue' };
    case 'PENDING_APPROVAL':
    default:
      return { label: 'Pending approval', variant: 'amber' };
  }
}

// Every possible document field, with a friendly label. Fields that are empty
// on a given applicant are skipped at render time.
const DOCUMENT_FIELDS = [
  { key: 'profilePhoto', label: 'Profile photo', source: 'professionalDetail' },
  { key: 'governmentId', label: 'Government ID', source: 'professionalDetail' },
  {
    key: 'identityDocument',
    label: 'Identity document',
    source: 'professionalDetail',
  },
  { key: 'resume', label: 'Resume', source: 'professionalDetail' },
  { key: 'profileResume', label: 'Resume', source: 'professionalDetail' },
  {
    key: 'degreeCertificate',
    label: 'Degree certificate',
    source: 'professionalDetail',
  },
  // Lawyer documents
  {
    key: 'advocateLicense',
    label: 'Advocate license',
    source: 'lawyerDetail',
  },
  {
    key: 'barRegistration',
    label: 'Bar registration',
    source: 'lawyerDetail',
  },
  {
    key: 'barRegistrationCertificate',
    label: 'Bar registration certificate',
    source: 'lawyerDetail',
  },
  {
    key: 'practiceCertificate',
    label: 'Practice certificate',
    source: 'lawyerDetail',
  },
  { key: 'lawDegree', label: 'Law degree', source: 'lawyerDetail' },
  {
    key: 'lawDegreeCertificate',
    label: 'Law degree certificate',
    source: 'lawyerDetail',
  },
  {
    key: 'supportingCertificates',
    label: 'Supporting certificates',
    source: 'lawyerDetail',
  },
  // Tax consultant documents
  {
    key: 'taxConsultantCertificate',
    label: 'Tax consultant certificate',
    source: 'taxConsultantDetail',
  },
  {
    key: 'registrationCertificate',
    label: 'Registration certificate',
    source: 'taxConsultantDetail',
  },
  {
    key: 'professionalLicense',
    label: 'Professional license',
    source: 'taxConsultantDetail',
  },
  {
    key: 'supportingCertifications',
    label: 'Supporting certifications',
    source: 'taxConsultantDetail',
  },
];

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-40 w-full animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminProfessionalReviewPage() {
  const router = useRouter();
  const params = useParams();
  const approvalId = params && params.id;
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Document preview modal state.
  const [preview, setPreview] = useState(null); // { url, name }

  // Action modal state.
  const [rejectOpen, setRejectOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Action feedback / loading.
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const isAdmin = user && user.role === ROLES.PLATFORM_ADMIN;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!approvalId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getProfessionalReview(approvalId);
      setReview(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load the review.');
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      load();
    }
  }, [authLoading, isAuthenticated, isAdmin, load]);

  // ----- Actions -----------------------------------------------------------

  async function handleApprove() {
    if (submitting) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Approve this professional? They will be notified.')
    ) {
      return;
    }
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      await approveProfessional(approvalId);
      setActionSuccess('Professional approved. Returning to the list…');
      setTimeout(() => router.push('/admin/professionals'), 900);
    } catch (err) {
      setActionError(err.message || 'Failed to approve.');
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (submitting) return;
    if (!reason.trim()) {
      setActionError('A reason is required to reject.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      await rejectProfessional(approvalId, reason.trim());
      setRejectOpen(false);
      setActionSuccess('Professional rejected. Returning to the list…');
      setTimeout(() => router.push('/admin/professionals'), 900);
    } catch (err) {
      setActionError(err.message || 'Failed to reject.');
      setSubmitting(false);
    }
  }

  async function handleRequestInfo() {
    if (submitting) return;
    if (!infoMessage.trim()) {
      setActionError('A message is required to request more information.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      await requestProfessionalInfo(approvalId, infoMessage.trim());
      setInfoOpen(false);
      setInfoMessage('');
      setActionSuccess('Information request sent. Reloading…');
      setSubmitting(false);
      await load();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to send the request.');
      setSubmitting(false);
    }
  }

  // ----- Guards ------------------------------------------------------------

  if (authLoading || !isAuthenticated) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Review professional" />
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Review professional">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to review professionals."
          action={
            <Button href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  // ----- Loading / error ---------------------------------------------------

  if (loading) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Review professional">
        <DetailSkeleton />
      </DashboardLayout>
    );
  }

  if (error || !review) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Review professional">
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={22} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {error || 'This review could not be found.'}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" href="/admin/professionals">
                <ArrowLeft size={15} />
                Back to list
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

  // ----- Data --------------------------------------------------------------

  // The API can return `null` for sub-objects that don't exist (e.g. a
  // firm-owner user with no professional details). Destructure defaults only
  // kick in for `undefined`, so coerce explicitly to avoid crashes.
  const approval = review.approval || {};
  const applicant = review.user || {};
  const address = review.address || {};
  const professionalDetail = review.professionalDetail || {};
  const lawyerDetail = review.lawyerDetail || null;
  const taxConsultantDetail = review.taxConsultantDetail || null;

  const name = userName(applicant);
  const badge = statusBadge(approval.status);
  const decided =
    approval.status === 'APPROVED' || approval.status === 'REJECTED';

  const pd = professionalDetail || {};
  const photoUrl = resolveFileUrl(
    pd.profilePhoto || applicant.profilePhoto || ''
  );

  // Collect all non-empty documents across detail objects.
  const sources = {
    professionalDetail: pd,
    lawyerDetail: lawyerDetail || {},
    taxConsultantDetail: taxConsultantDetail || {},
  };
  const seenUrls = new Set();
  const documents = [];
  for (const def of DOCUMENT_FIELDS) {
    const src = sources[def.source] || {};
    const value = src[def.key];
    if (value && typeof value === 'string' && !seenUrls.has(value)) {
      seenUrls.add(value);
      documents.push({ label: def.label, url: value });
    }
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Review professional"
      subtitle={name}
    >
      <div className="space-y-6">
        {/* Back link */}
        <div>
          <Button size="sm" variant="ghost" href="/admin/professionals">
            <ArrowLeft size={15} />
            Back to approvals
          </Button>
        </div>

        {/* Action / success / error feedback */}
        {actionSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} />
            {actionError}
          </div>
        )}

        {/* Applicant */}
        <Section icon={<User size={16} />} title="Applicant">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={name}
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xl font-semibold text-white">
                {getInitials(name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {name}
                </h3>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Email" value={applicant.email} />
                <Field
                  label="Mobile"
                  value={applicant.mobileNumber || applicant.mobile}
                />
                <Field label="Role" value={applicant.role} />
                <Field
                  label="Professional type"
                  value={approval.professionalType}
                />
                <Field
                  label="Submitted"
                  value={formatDate(approval.submittedAt)}
                />
                <Field
                  label="Resubmissions"
                  value={
                    approval.resubmissionCount !== undefined
                      ? String(approval.resubmissionCount)
                      : null
                  }
                />
              </dl>
            </div>
          </div>
        </Section>

        {/* Address */}
        <Section icon={<MapPin size={16} />} title="Address">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Address line" value={address.addressLine} />
            <Field label="City" value={address.city} />
            <Field label="State" value={address.state} />
            <Field label="Country" value={address.country} />
            <Field label="Postal code" value={address.postalCode} />
          </dl>
          {!address.addressLine &&
            !address.city &&
            !address.state &&
            !address.country && (
              <p className="text-sm text-slate-400">
                No address details provided.
              </p>
            )}
        </Section>

        {/* Professional details */}
        <Section icon={<Briefcase size={16} />} title="Professional details">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Designation" value={pd.designation} />
            <Field label="Organization" value={pd.organization} />
            <Field
              label="Years of experience"
              value={
                pd.yearsOfExperience !== undefined &&
                pd.yearsOfExperience !== null
                  ? String(pd.yearsOfExperience)
                  : pd.experience !== undefined && pd.experience !== null
                  ? String(pd.experience)
                  : null
              }
            />
            <Field
              label="Consultation fee"
              value={
                pd.consultationFee !== undefined && pd.consultationFee !== null
                  ? String(pd.consultationFee)
                  : null
              }
            />
            <Field label="Availability" value={pd.availability} />
            <Field
              label="Website"
              value={
                pd.website ? (
                  <a
                    href={pd.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    {pd.website}
                  </a>
                ) : null
              }
            />
            <Field
              label="LinkedIn"
              value={
                pd.linkedin || pd.linkedIn ? (
                  <a
                    href={pd.linkedin || pd.linkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    {pd.linkedin || pd.linkedIn}
                  </a>
                ) : null
              }
            />
          </dl>
          {pd.bio && (
            <div className="mt-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Bio
              </dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {pd.bio}
              </dd>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ChipList label="Skills" value={pd.skills} />
            <ChipList label="Expertise" value={pd.expertise} />
            <ChipList label="Languages" value={pd.languages} />
            <ChipList label="Education" value={pd.education} />
            <ChipList label="Certifications" value={pd.certifications} />
          </div>
        </Section>

        {/* Lawyer-specific */}
        {lawyerDetail && (
          <Section icon={<Scale size={16} />} title="Legal details">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Bar council ID"
                value={lawyerDetail.barCouncilId}
              />
              <Field
                label="Bar registration number"
                value={lawyerDetail.barRegistrationNumber}
              />
              <Field
                label="Enrollment number"
                value={lawyerDetail.enrollmentNumber}
              />
              <Field
                label="Enrollment year"
                value={
                  lawyerDetail.enrollmentYear
                    ? String(lawyerDetail.enrollmentYear)
                    : null
                }
              />
              <Field label="Bar council" value={lawyerDetail.barCouncil} />
              <Field
                label="Court of practice"
                value={lawyerDetail.courtOfPractice}
              />
              <Field
                label="Jurisdiction"
                value={lawyerDetail.jurisdiction}
              />
              <Field
                label="Practice areas"
                value={
                  Array.isArray(lawyerDetail.practiceAreas)
                    ? null
                    : lawyerDetail.practiceAreas
                }
              />
            </dl>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ChipList
                label="Practice areas"
                value={
                  Array.isArray(lawyerDetail.practiceAreas)
                    ? lawyerDetail.practiceAreas
                    : null
                }
              />
              <ChipList
                label="Specializations"
                value={lawyerDetail.specializations}
              />
            </div>
          </Section>
        )}

        {/* Tax consultant-specific */}
        {taxConsultantDetail && (
          <Section
            icon={<Calculator size={16} />}
            title="Tax consultant details"
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Registration number"
                value={taxConsultantDetail.registrationNumber}
              />
              <Field
                label="Membership number"
                value={taxConsultantDetail.membershipNumber}
              />
              <Field
                label="Qualification"
                value={taxConsultantDetail.qualification}
              />
              <Field
                label="Firm / association"
                value={taxConsultantDetail.firmName}
              />
              <Field
                label="GSTIN"
                value={taxConsultantDetail.gstin || taxConsultantDetail.gstNumber}
              />
              <Field
                label="PAN"
                value={taxConsultantDetail.pan || taxConsultantDetail.panNumber}
              />
            </dl>
            <div className="mt-4">
              <dt className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Areas of expertise
              </dt>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <BoolField
                  label="Income tax"
                  value={taxConsultantDetail.incomeTax}
                />
                <BoolField label="GST" value={taxConsultantDetail.gst} />
                <BoolField
                  label="TDS"
                  value={taxConsultantDetail.tds}
                />
                <BoolField
                  label="Corporate tax"
                  value={taxConsultantDetail.corporateTax}
                />
                <BoolField
                  label="International tax"
                  value={taxConsultantDetail.internationalTax}
                />
                <BoolField
                  label="Tax audit"
                  value={taxConsultantDetail.taxAudit}
                />
                <BoolField
                  label="Company registration"
                  value={taxConsultantDetail.companyRegistration}
                />
                <BoolField
                  label="Accounting & bookkeeping"
                  value={taxConsultantDetail.accounting}
                />
                <BoolField
                  label="Compliance"
                  value={taxConsultantDetail.compliance}
                />
              </div>
            </div>
          </Section>
        )}

        {/* Documents */}
        <Section icon={<FileText size={16} />} title="Documents">
          {documents.length === 0 ? (
            <p className="text-sm text-slate-400">No documents uploaded.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <div
                  key={doc.label + doc.url}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <FileText size={16} />
                    </span>
                    <p className="truncate text-sm font-medium text-slate-700">
                      {doc.label}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPreview({ url: doc.url, name: doc.label })
                    }
                  >
                    <Eye size={15} />
                    Preview
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Action bar OR decision */}
        {decided ? (
          <Card
            className={
              approval.status === 'APPROVED'
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50'
            }
          >
            <div className="flex items-start gap-3">
              {approval.status === 'APPROVED' ? (
                <CheckCircle2 size={20} className="mt-0.5 text-emerald-600" />
              ) : (
                <XCircle size={20} className="mt-0.5 text-red-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  This application has already been{' '}
                  {approval.status === 'APPROVED' ? 'approved' : 'rejected'}.
                </p>
                {approval.decisionReason && (
                  <p className="mt-1 text-sm text-slate-600">
                    {approval.decisionReason}
                  </p>
                )}
                {approval.rejectionReason && (
                  <p className="mt-1 text-sm text-slate-600">
                    {approval.rejectionReason}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <div className="sticky bottom-4 z-10 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-700">
                Decide on this application
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionError('');
                    setInfoOpen(true);
                  }}
                  disabled={submitting}
                >
                  <MessageSquare size={15} />
                  Request more info
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setActionError('');
                    setReason('');
                    setRejectOpen(true);
                  }}
                  disabled={submitting}
                >
                  <X size={15} />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={submitting}
                >
                  <Check size={15} />
                  {submitting ? 'Working…' : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Document preview */}
      <DocumentPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        url={preview ? preview.url : ''}
        name={preview ? preview.name : ''}
      />

      {/* Reject modal */}
      <Modal
        open={rejectOpen}
        onClose={() => !submitting && setRejectOpen(false)}
        title="Reject application"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              disabled={submitting || !reason.trim()}
            >
              {submitting ? 'Rejecting…' : 'Confirm reject'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Provide a reason for rejecting this professional. They will see this
          message.
        </p>
        <label
          htmlFor="reject-reason"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          id="reject-reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this application is being rejected…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
        />
        {actionError && rejectOpen && (
          <p className="mt-2 text-xs text-red-600">{actionError}</p>
        )}
      </Modal>

      {/* Request info modal */}
      <Modal
        open={infoOpen}
        onClose={() => !submitting && setInfoOpen(false)}
        title="Request more information"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInfoOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRequestInfo}
              disabled={submitting || !infoMessage.trim()}
            >
              {submitting ? 'Sending…' : 'Send request'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Tell the professional what additional information or documents you
          need. They will be able to resubmit.
        </p>
        <label
          htmlFor="info-message"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="info-message"
          rows={4}
          value={infoMessage}
          onChange={(e) => setInfoMessage(e.target.value)}
          placeholder="Describe what is missing or needs clarification…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        {actionError && infoOpen && (
          <p className="mt-2 text-xs text-red-600">{actionError}</p>
        )}
      </Modal>
    </DashboardLayout>
  );
}
