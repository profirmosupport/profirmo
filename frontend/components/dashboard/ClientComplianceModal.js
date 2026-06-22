'use client';

// ClientComplianceModal — per-client compliance profile editor.
// Opened from the Clients table; lets a pro:
//   1. Pick the client's entity type + GST/TDS / audit flags so the
//      generator knows which rules apply.
//   2. Save the profile.
//   3. Click "Generate schedule" to materialize upcoming obligations
//      into the compliance calendar (next 12 months). Generate is
//      idempotent — re-running won't duplicate.

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Save, AlertTriangle } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import {
  getProfile,
  saveProfile,
  generateForClient,
  getRequirements,
} from '@/services/complianceService';

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

export default function ClientComplianceModal({
  open,
  onClose,
  clientUserId,
  clientName,
}) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  // True once the existing profile (if any) has been fetched — so the
  // "Generate schedule" button knows whether a profile exists yet.
  const [profileExists, setProfileExists] = useState(false);
  // Live-fetched per-entity-type document + service requirements,
  // refetched whenever the user picks a different entity type.
  const [requirements, setRequirements] = useState(null);

  const load = useCallback(async () => {
    if (!open || !clientUserId) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const profile = await getProfile(clientUserId);
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
      setError(err.message || 'Could not load compliance profile.');
    } finally {
      setLoading(false);
    }
  }, [open, clientUserId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch the document + service catalog whenever the entity type
  // changes — switching from individual → private_ltd swaps in
  // companies-act items, etc.
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
      await saveProfile(clientUserId, form);
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
      await saveProfile(clientUserId, form);
      setProfileExists(true);
      const out = await generateForClient(clientUserId);
      setResult(out);
    } catch (err) {
      setError(err.message || 'Generate failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Compliance profile — ${clientName || 'Client'}`}
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving || generating}
          >
            Close
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving || generating || loading}
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAndGenerate}
            disabled={saving || generating || loading}
          >
            <Sparkles size={14} />
            {generating ? 'Generating…' : 'Save + generate schedule'}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading existing profile…</p>
      ) : (
        <div className="space-y-4">
          {error && (
            <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {result && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Generated {result.created} new obligation
              {result.created === 1 ? '' : 's'} ({result.existing} already
              existed). View them on{' '}
              <a
                href="/dashboard/professional/compliance"
                className="font-semibold underline"
              >
                /compliance
              </a>{' '}
              or on the dashboard calendar.
            </p>
          )}

          {!profileExists && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No compliance profile saved yet for this client. Fill in the
              entity type + relevant flags below, then save or generate.
            </p>
          )}

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
                CIN (companies only)
              </label>
              <input
                type="text"
                value={form.cin}
                onChange={(e) => update('cin', e.target.value.toUpperCase())}
                placeholder="U72200KA2020PTC123456"
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
              Applicable obligations — toggle what fits
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.qrmpEligible}
                  onChange={(e) => update('qrmpEligible', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium">QRMP eligible</span>
                  <br />
                  <span className="text-[11px] text-slate-500">
                    Turnover ≤ ₹5cr previous FY. Drives quarterly GSTR-1.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.tdsDeductor}
                  onChange={(e) => update('tdsDeductor', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium">TDS deductor</span>
                  <br />
                  <span className="text-[11px] text-slate-500">
                    Generates quarterly 24Q/26Q + monthly TDS payment.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.taxAuditRequired}
                  onChange={(e) => update('taxAuditRequired', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium">Tax audit (44AB)</span>
                  <br />
                  <span className="text-[11px] text-slate-500">
                    Switches ITR due date to 31 Oct + adds Form 3CD due 30 Sep.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.gstr9cRequired}
                  onChange={(e) => update('gstr9cRequired', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium">GSTR-9C required</span>
                  <br />
                  <span className="text-[11px] text-slate-500">
                    Turnover above ₹5cr. Reconciliation statement due 31 Dec.
                  </span>
                </span>
              </label>
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
              placeholder="Anything to flag — e.g. handling joint filings, special exemptions…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* Documents + services catalog. Auto-driven from
              entityType — shows what to ask the client for and which
              recurring services apply. Reference-only for v1;
              upload + done-tracking lands with the document-workflow
              module. */}
          {requirements && (
            <DocsServicesPanel requirements={requirements} />
          )}
        </div>
      )}
    </Modal>
  );
}

// Category → header style for the docs section. Keeps the visual
// hierarchy lighter than the rest of the form.
const CAT_LABEL = {
  kyc: 'KYC',
  registration: 'Registration',
  financial: 'Financial',
  compliance: 'Statutory compliance',
};

function DocsServicesPanel({ requirements }) {
  // Group documents by category for readability.
  const byCat = new Map();
  for (const d of requirements.documents) {
    const cat = d.category || 'other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(d);
  }
  const catOrder = ['kyc', 'registration', 'financial', 'compliance'];
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Documents to collect ({requirements.documents.length})
        </p>
        <p className="text-[11px] text-slate-500">
          Standard checklist for a {requirements.label}. Ask the client
          for the mandatory items first — the rest depend on their
          situation.
        </p>
      </div>
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

      <div>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Recurring services ({requirements.services.length})
        </p>
        <ul className="mt-1 space-y-1">
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
    </div>
  );
}
