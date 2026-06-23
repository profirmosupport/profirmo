'use client';

// /dashboard/professional/clients/[clientId] — full client detail
// page. Lands you on the compliance editor inline (replacing the
// old modal). Same fields + behaviour as the modal had, but with
// breathing room for the docs / services catalog to render properly
// instead of being squeezed into a popup.
//
// Future iterations: hook in case history, billing summary, document
// uploads, communication log etc. as additional cards on this page.

import { use, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Receipt,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import clientService from '@/services/clientService';
import {
  getProfile,
  saveProfile,
  generateForClient,
  getRequirements,
} from '@/services/complianceService';
import ClientDocumentsPanel from '@/components/clients/ClientDocumentsPanel';
import { ROLES } from '@/utils/constants';

const ENTITY_TYPES = [
  { value: '', label: '— Select —' },
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

const CAT_LABEL = {
  kyc: 'KYC',
  registration: 'Registration',
  financial: 'Financial',
  compliance: 'Statutory compliance',
};

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

/**
 * Per-entity-type field visibility. Hides fields that don't apply so
 * the form isn't cluttered with questions the user has no answer for
 * (e.g. GSTIN / CIN for an individual). PAN + Tax audit show for
 * every entity type because both can apply to almost any taxpayer.
 */
function fieldVisibility(entityType) {
  const v = {
    gstin: false,
    gstScheme: false,
    cin: false,
    qrmpEligible: false,
    tdsDeductor: false,
    taxAuditRequired: true,
    gstr9cRequired: false,
  };
  if (!entityType) return v;
  if (entityType === 'individual' || entityType === 'huf') return v;
  v.gstin = true;
  v.gstScheme = true;
  v.qrmpEligible = true;
  v.gstr9cRequired = true;
  v.tdsDeductor = true;
  if (entityType === 'private_ltd' || entityType === 'public_ltd') {
    v.cin = true;
  }
  return v;
}

export default function ProfessionalClientDetailPage({ params }) {
  // Next.js 15 — params is a thenable; unwrap via use().
  const { clientId } = use(params);

  const [client, setClient] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [profileExists, setProfileExists] = useState(false);
  const [requirements, setRequirements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, profile] = await Promise.all([
        clientService.getById(clientId),
        getProfile(clientId),
      ]);
      setClient(c);
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
        setProfileExists(true);
      } else {
        setForm(EMPTY);
        setProfileExists(false);
      }
    } catch (err) {
      setError(err.message || 'Could not load client.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

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
    setResult(null);
    try {
      await saveProfile(clientId, form);
      setProfileExists(true);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndGenerate() {
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      await saveProfile(clientId, form);
      setProfileExists(true);
      const out = await generateForClient(clientId);
      setResult(out);
    } catch (err) {
      setError(err.message || 'Generate failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.PROFESSIONAL}
      title={client ? client.name || 'Client' : 'Client'}
      subtitle="Profile, compliance + filings"
    >
      <div className="space-y-5">
        <div>
          <a
            href="/dashboard/professional/clients"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={12} />
            Back to clients
          </a>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {/* --- Client basics (read-only — owned by the client) ------ */}
        {client && <ClientBasicsCard client={client} />}

        {/* --- Compliance profile editor ----------------------------- */}
        <Card>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Receipt size={16} />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">
                Compliance profile
              </h3>
              <p className="text-xs text-slate-500">
                Set the entity type + flags. Save, or save + generate the
                upcoming filing schedule (next 12 months, idempotent).
              </p>
            </div>
          </div>

          {!profileExists && !loading && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No compliance profile saved yet for this client. Fill the
              entity type + relevant flags below, then Save or
              Save + generate.
            </p>
          )}

          {result && (
            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Generated {result.created} new obligation
              {result.created === 1 ? '' : 's'} ({result.existing} already
              existed).{' '}
              <a
                href="/dashboard/professional/compliance"
                className="font-semibold underline"
              >
                View on /compliance
              </a>
              .
            </p>
          )}

          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : (
            (() => {
              const vis = fieldVisibility(form.entityType);
              const TOGGLES = [
                vis.qrmpEligible && [
                  'qrmpEligible',
                  'QRMP eligible',
                  'Turnover ≤ ₹5cr previous FY. Drives quarterly GSTR-1.',
                ],
                vis.tdsDeductor && [
                  'tdsDeductor',
                  'TDS deductor',
                  'Generates quarterly 24Q/26Q + monthly TDS payment.',
                ],
                vis.taxAuditRequired && [
                  'taxAuditRequired',
                  'Tax audit (44AB)',
                  'Switches ITR due date to 31 Oct + adds Form 3CD due 30 Sep.',
                ],
                vis.gstr9cRequired && [
                  'gstr9cRequired',
                  'GSTR-9C required',
                  'Turnover above ₹5cr. Reconciliation statement due 31 Dec.',
                ],
              ].filter(Boolean);
              return (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Entity type *
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
                        onChange={(e) =>
                          update('pan', e.target.value.toUpperCase())
                        }
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                      />
                    </div>
                    {vis.gstin && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          GSTIN
                        </label>
                        <input
                          type="text"
                          value={form.gstin}
                          onChange={(e) =>
                            update('gstin', e.target.value.toUpperCase())
                          }
                          placeholder="27ABCDE1234F1Z5"
                          maxLength={15}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                        />
                      </div>
                    )}
                    {vis.cin && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          CIN
                        </label>
                        <input
                          type="text"
                          value={form.cin}
                          onChange={(e) =>
                            update('cin', e.target.value.toUpperCase())
                          }
                          placeholder="U72200KA2020PTC123456"
                          maxLength={30}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                        />
                      </div>
                    )}
                    {vis.gstScheme && (
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
                    )}
                  </div>

                  {TOGGLES.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Applicable obligations
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {TOGGLES.map(([k, label, desc]) => (
                          <label
                            key={k}
                            className="flex items-start gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={!!form[k]}
                              onChange={(e) => update(k, e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300"
                            />
                            <span>
                              <span className="font-medium">{label}</span>
                              <br />
                              <span className="text-[11px] text-slate-500">
                                {desc}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

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

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || generating}
                >
                  <Save size={14} />
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAndGenerate}
                  disabled={saving || generating}
                >
                  <Sparkles size={14} />
                  {generating ? 'Generating…' : 'Save + generate schedule'}
                </Button>
              </div>
            </div>
              );
            })()
          )}
        </Card>

        {/* --- Client documents (upload + access) ------------------ */}
        <ClientDocumentsPanel
          clientUserId={clientId}
          requirements={requirements}
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
                  Documents + services for a {requirements.label}
                </h3>
                <p className="text-xs text-slate-500">
                  Standard checklist + recurring services. Red dot =
                  mandatory.
                </p>
              </div>
            </div>
            <DocsByCategory documents={requirements.documents} />
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recurring services ({requirements.services.length})
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

/**
 * ClientBasicsCard — read-only display of the client's identity
 * fields. The professional can't edit Name / Email / Phone here —
 * those belong to the client account and the client updates them
 * from their own profile.
 */
function ClientBasicsCard({ client }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Client basics
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        {client.name || '—'}
      </h2>
      <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <span className="text-xs uppercase text-slate-400">Email</span>
          <p>{client.email || '—'}</p>
        </div>
        <div>
          <span className="text-xs uppercase text-slate-400">Phone</span>
          <p>{client.phone || '—'}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Identity fields are owned by the client — they can update them
        from their own profile.
      </p>
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
