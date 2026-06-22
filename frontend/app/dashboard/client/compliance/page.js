'use client';

// /dashboard/client/compliance — the client's own view of their tax /
// legal compliance state:
//   1. Their entity-type profile (editable — propagates to all their
//      pros via PUT /api/compliance/profile/me).
//   2. Upcoming obligations across every pro they work with
//      (read-only — only the pro can mark items done).
//   3. The standard document checklist + services list for their
//      entity type so they know what to gather.

import { useCallback, useEffect, useState } from 'react';
import {
  Receipt,
  Save,
  AlertTriangle,
  FileText,
  Briefcase,
  Upload,
  ExternalLink,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Clock,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import {
  getMyProfile,
  saveMyProfile,
  listMyObligations,
  getRequirements,
} from '@/services/complianceService';
import {
  listForClient as listMyDocuments,
  uploadDocument,
  getDocumentUrl,
  deleteDocument,
  listMyAccessAsClient,
  decideAccess,
} from '@/services/clientDocumentService';
import { useAuth } from '@/hooks/useAuth';
import { ROLES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';

const ENTITY_TYPES = [
  { value: '', label: '— Not set —' },
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

const GST_SCHEMES = [
  { value: '', label: '— None —' },
  { value: 'regular', label: 'Regular' },
  { value: 'composition', label: 'Composition' },
  { value: 'casual', label: 'Casual' },
  { value: 'isd', label: 'Input Service Distributor' },
];

const EMPTY = {
  entityType: '',
  pan: '',
  gstin: '',
  cin: '',
  gstScheme: '',
  qrmpEligible: false,
  tdsDeductor: false,
  taxAuditRequired: false,
  gstr9cRequired: false,
  notes: '',
};

const STATUS_VARIANT = {
  pending: 'amber',
  done: 'green',
  missed: 'red',
  not_applicable: 'gray',
};

const STATUS_LABEL = {
  pending: 'Pending',
  done: 'Done',
  missed: 'Missed',
  not_applicable: 'N/A',
};

const CAT_LABEL = {
  kyc: 'KYC',
  registration: 'Registration',
  financial: 'Financial',
  compliance: 'Statutory',
};

export default function ClientCompliancePage() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [requirements, setRequirements] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [myDocs, setMyDocs] = useState([]);
  const [accessRows, setAccessRows] = useState([]);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [accessBusyId, setAccessBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profile, items, accessList] = await Promise.all([
        getMyProfile(),
        listMyObligations({ status: 'pending' }),
        listMyAccessAsClient(),
      ]);
      if (profile) {
        setForm({
          entityType: profile.entityType || '',
          pan: profile.pan || '',
          gstin: profile.gstin || '',
          cin: profile.cin || '',
          gstScheme: profile.gstScheme || '',
          qrmpEligible: !!profile.qrmpEligible,
          tdsDeductor: !!profile.tdsDeductor,
          taxAuditRequired: !!profile.taxAuditRequired,
          gstr9cRequired: !!profile.gstr9cRequired,
          notes: profile.notes || '',
        });
        setProfileLoaded(true);
      } else {
        setProfileLoaded(false);
      }
      setObligations(Array.isArray(items) ? items : []);
      setAccessRows(Array.isArray(accessList) ? accessList : []);
      // Documents are loaded once we have the user id.
      if (user && user.id) {
        try {
          const docs = await listMyDocuments(user.id);
          setMyDocs(docs);
        } catch {
          /* ignore — docs panel will show empty */
        }
      }
    } catch (err) {
      setError(err.message || 'Could not load compliance details.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (!form.entityType) {
      setRequirements(null);
      return undefined;
    }
    (async () => {
      try {
        const r = await getRequirements(form.entityType);
        if (!cancelled) setRequirements(r);
      } catch {
        if (!cancelled) setRequirements(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.entityType]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await saveMyProfile(form);
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.CLIENT}
      title="Compliance"
      subtitle="Your filings, statutory deadlines and the documents your professional needs."
    >
      <div className="space-y-5">
        {error && (
          <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {/* --- Profile editor ---------------------------------------- */}
        <Card>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Receipt size={16} />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">
                Your profile
              </h3>
              <p className="text-xs text-slate-500">
                {profileLoaded
                  ? 'Updates here are visible to every professional you work with.'
                  : 'Fill these in so your professional can plan your filings.'}
              </p>
            </div>
            {savedAt && (
              <span className="text-[11px] text-emerald-700">
                Saved {savedAt.toLocaleTimeString()}
              </span>
            )}
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading profile…</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Entity type
                  </label>
                  <select
                    value={form.entityType}
                    onChange={(e) => update('entityType', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {ENTITY_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    PAN
                  </label>
                  <input
                    type="text"
                    value={form.pan}
                    onChange={(e) => update('pan', e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={form.gstin}
                    onChange={(e) => update('gstin', e.target.value.toUpperCase())}
                    placeholder="27ABCDE1234F1Z5"
                    maxLength={15}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    CIN (companies)
                  </label>
                  <input
                    type="text"
                    value={form.cin}
                    onChange={(e) => update('cin', e.target.value.toUpperCase())}
                    maxLength={30}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    GST scheme
                  </label>
                  <select
                    value={form.gstScheme}
                    onChange={(e) => update('gstScheme', e.target.value)}
                    disabled={!form.gstin}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {GST_SCHEMES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Applicable obligations
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    ['qrmpEligible', 'QRMP eligible (turnover ≤ ₹5cr)'],
                    ['tdsDeductor', 'I deduct TDS (24Q/26Q applicable)'],
                    ['taxAuditRequired', 'Tax audit (44AB) required'],
                    ['gstr9cRequired', 'GSTR-9C required (turnover > ₹5cr)'],
                  ].map(([k, label]) => (
                    <label
                      key={k}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={!!form[k]}
                        onChange={(e) => update(k, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save size={14} />
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* --- Upcoming obligations --------------------------------- */}
        <Card>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Briefcase size={16} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Upcoming filings
              </h3>
              <p className="text-xs text-slate-500">
                Your professional generates these from your profile. You can
                only see them here — they mark them done once filed.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : obligations.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
              No upcoming filings on file yet. Once your professional
              generates a schedule, the upcoming items show here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {obligations.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {o.ruleKey.toUpperCase()}{' '}
                      <span className="text-xs text-slate-500">
                        — {o.periodLabel}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Due {formatDate(o.dueDate)}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[o.status] || 'gray'}>
                    {STATUS_LABEL[o.status] || o.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* --- My documents ----------------------------------------- */}
        {user && user.id && (
          <MyDocumentsCard
            clientUserId={user.id}
            requirements={requirements}
            docs={myDocs}
            uploadingKey={uploadingKey}
            onUpload={async (docKey, label, file) => {
              if (!file) return;
              setUploadingKey(docKey);
              setError('');
              try {
                await uploadDocument(user.id, file, { docKey, label });
                const fresh = await listMyDocuments(user.id);
                setMyDocs(fresh);
              } catch (err) {
                setError(err.message || 'Upload failed.');
              } finally {
                setUploadingKey(null);
              }
            }}
            onView={async (doc) => {
              try {
                const out = await getDocumentUrl(doc.id);
                if (out && out.url)
                  window.open(out.url, '_blank', 'noopener,noreferrer');
              } catch (err) {
                setError(err.message || 'Could not open.');
              }
            }}
            onDelete={async (doc) => {
              if (!window.confirm(`Delete "${doc.fileName || 'document'}"?`)) return;
              try {
                await deleteDocument(doc.id);
                const fresh = await listMyDocuments(user.id);
                setMyDocs(fresh);
              } catch (err) {
                setError(err.message || 'Delete failed.');
              }
            }}
          />
        )}

        {/* --- Professional access (grant / deny / revoke) ---------- */}
        <ProfessionalAccessCard
          rows={accessRows}
          busyId={accessBusyId}
          onDecide={async (id, decision) => {
            setAccessBusyId(id);
            setError('');
            try {
              await decideAccess(id, decision);
              const fresh = await listMyAccessAsClient();
              setAccessRows(Array.isArray(fresh) ? fresh : []);
            } catch (err) {
              setError(err.message || 'Could not save decision.');
            } finally {
              setAccessBusyId(null);
            }
          }}
        />

        {/* --- Documents + services catalog ------------------------- */}
        {requirements && (
          <Card>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <FileText size={16} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Documents your professional may ask for
                </h3>
                <p className="text-xs text-slate-500">
                  Standard checklist for a {requirements.label}. Have these
                  ready when your professional reaches out.
                </p>
              </div>
            </div>
            <DocsByCategory documents={requirements.documents} />
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Services typically delivered
              </p>
              <ul className="space-y-1">
                {requirements.services.map((s) => (
                  <li
                    key={s.key}
                    className="flex items-start gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <span className="mt-0.5 inline-block rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700">
                      {s.cadence || 'ad-hoc'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{s.label}</p>
                      {s.description && (
                        <p className="text-[11px] text-slate-500">
                          {s.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UploadButton({ docKey, label, disabled, isUploading, onFile }) {
  return (
    <label
      className={[
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition',
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
          : 'cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
      ].join(' ')}
    >
      <Upload size={12} />
      {isUploading ? 'Uploading…' : 'Upload'}
      <input
        type="file"
        className="hidden"
        disabled={disabled}
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = '';
          if (f) onFile(docKey, label, f);
        }}
      />
    </label>
  );
}

/**
 * MyDocumentsCard — client-side document upload + listing. Mirrors
 * the catalog the pro sees on the manage page, but here the client
 * is uploading directly. The client always sees all their docs
 * regardless of who uploaded them.
 */
function MyDocumentsCard({
  clientUserId,
  requirements,
  docs,
  uploadingKey,
  onUpload,
  onView,
  onDelete,
}) {
  const docsByKey = new Map();
  for (const d of docs || []) {
    if (!docsByKey.has(d.docKey)) docsByKey.set(d.docKey, []);
    docsByKey.get(d.docKey).push(d);
  }
  const items = (requirements && requirements.documents) || [];
  const byCat = new Map();
  for (const d of items) {
    const cat = d.category || 'other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(d);
  }
  const catOrder = ['kyc', 'registration', 'financial', 'compliance'];
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-purple-600">
          <Upload size={16} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Your documents
          </h3>
          <p className="text-xs text-slate-500">
            Upload to Profirmo's secure storage. Only you and the
            professionals you grant access to can see these.
          </p>
        </div>
      </div>

      {!requirements ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          Pick your entity type above so we can show the right document
          checklist.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {catOrder
            .filter((c) => byCat.has(c))
            .map((cat) => (
              <div key={cat}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {CAT_LABEL[cat] || cat}
                </p>
                <ul className="space-y-2">
                  {byCat.get(cat).map((d) => {
                    const uploaded = docsByKey.get(d.key) || [];
                    return (
                      <li
                        key={d.key}
                        className="rounded-lg border border-slate-200 bg-white p-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={[
                                  'inline-block h-2 w-2 shrink-0 rounded-full',
                                  d.mandatory ? 'bg-red-500' : 'bg-slate-300',
                                ].join(' ')}
                              />
                              <p className="text-sm font-medium text-slate-800">
                                {d.label}
                              </p>
                              {uploaded.length > 0 && (
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  {uploaded.length} uploaded
                                </span>
                              )}
                            </div>
                            {d.description && (
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {d.description}
                              </p>
                            )}
                          </div>
                          <UploadButton
                            docKey={d.key}
                            label={d.label}
                            disabled={uploadingKey === d.key}
                            isUploading={uploadingKey === d.key}
                            onFile={onUpload}
                          />
                        </div>
                        {uploaded.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {uploaded.map((u) => (
                              <li
                                key={u.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-slate-700">
                                    {u.fileName || '(file)'}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {u.mimeType} · {fmtSize(u.size)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onView(u)}
                                    className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                    title="Open"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDelete(u)}
                                    className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

/**
 * ProfessionalAccessCard — list of all pros who've requested OR been
 * granted access to the client's document store. Client can flip the
 * status of any row to grant / deny / revoke.
 */
function ProfessionalAccessCard({ rows, busyId, onDecide }) {
  if (!rows || rows.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <ShieldCheck size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Professional access
            </h3>
            <p className="text-xs text-slate-500">
              When a professional asks to see all your documents, the
              request appears here for you to allow or deny.
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          No access requests yet.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <ShieldCheck size={16} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Professional access
          </h3>
          <p className="text-xs text-slate-500">
            Allow or revoke each professional's access to your full
            document set. (They always see what they themselves
            uploaded.)
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-slate-500">
                {r.professionalId}
              </p>
              {r.requestNote && (
                <p className="mt-0.5 text-xs text-slate-600">
                  &ldquo;{r.requestNote}&rdquo;
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-slate-400">
                Status:{' '}
                <span className="font-semibold text-slate-700">
                  {r.status}
                </span>
                {r.decidedAt &&
                  ` · decided ${new Date(r.decidedAt).toLocaleString()}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {r.status !== 'granted' && (
                <button
                  type="button"
                  onClick={() => onDecide(r.id, 'granted')}
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100"
                >
                  <ShieldCheck size={12} />
                  Allow
                </button>
              )}
              {r.status === 'granted' && (
                <button
                  type="button"
                  onClick={() => onDecide(r.id, 'revoked')}
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:border-amber-300 hover:bg-amber-100"
                >
                  <Clock size={12} />
                  Revoke
                </button>
              )}
              {r.status !== 'denied' && r.status !== 'revoked' && (
                <button
                  type="button"
                  onClick={() => onDecide(r.id, 'denied')}
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                >
                  <ShieldOff size={12} />
                  Deny
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DocsByCategory({ documents }) {
  const byCat = new Map();
  for (const d of documents) {
    const cat = d.category || 'other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(d);
  }
  const catOrder = ['kyc', 'registration', 'financial', 'compliance'];
  return (
    <div className="mt-4 space-y-3">
      {catOrder
        .filter((c) => byCat.has(c))
        .map((cat) => (
          <div key={cat}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {CAT_LABEL[cat] || cat}
            </p>
            <ul className="space-y-1">
              {byCat.get(cat).map((d) => (
                <li
                  key={d.key}
                  className="flex items-start gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  <span
                    className={[
                      'mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full',
                      d.mandatory ? 'bg-red-500' : 'bg-slate-300',
                    ].join(' ')}
                    title={d.mandatory ? 'Mandatory' : 'Optional'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{d.label}</p>
                    {d.description && (
                      <p className="text-[11px] text-slate-500">
                        {d.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
