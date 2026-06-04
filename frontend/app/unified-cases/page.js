'use client';

// Unified eCourt case lookup — backed by the Attestr "Unified eCourt
// Case Details" API. The browser hits our backend proxy at
// /api/attestr/unified-case which adds the Basic-auth token and
// forwards to https://api.attestr.com.
//
// UI: a form whose fields mirror the Attestr request body 1:1
// (courtType is required; supply at least one of cnr /
// registrationNumber / diaryNumber / filingNumber). Output renders
// every documented response field — parties, hearings, history,
// orders, acts, transfers, linked cases.

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
  Gavel,
  Landmark,
  Loader2,
  MapPin,
  Scale,
  Search,
  Sparkles,
  Users2,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { COURT_TYPES, fetchUnifiedCase } from '@/services/attestrService';

const EMPTY_FORM = {
  courtType: '',
  cnr: '',
  establishmentCode: '',
  caseType: '',
  registrationNumber: '',
  diaryNumber: '',
  filingNumber: '',
};

// Each field renders in the same way: label + small hint + input. Keeps
// the form definition declarative so courts can be added later without
// re-doing the layout.
const FIELDS = [
  {
    key: 'cnr',
    label: 'CNR number',
    placeholder: 'e.g. RJJS010001272025',
    hint: '16-char alphanumeric CNR.',
  },
  {
    key: 'establishmentCode',
    label: 'Establishment code',
    placeholder: 'e.g. TRHC01',
    hint: 'Bench/establishment code — varies by court type.',
  },
  {
    key: 'caseType',
    label: 'Case type code',
    placeholder: 'e.g. Arb.A.',
    hint: 'Case classification code — varies by court type.',
  },
  {
    key: 'registrationNumber',
    label: 'Registration number',
    placeholder: 'e.g. 1/2025',
    hint: 'Format: caseNumber/caseYear.',
  },
  {
    key: 'diaryNumber',
    label: 'Diary number',
    placeholder: 'e.g. 10/2026',
    hint: 'Format: diaryNumber/diaryYear (only some court types).',
  },
  {
    key: 'filingNumber',
    label: 'Filing number',
    placeholder: 'e.g. 1023400763',
    hint: 'Numeric filing number assigned by the registry.',
  },
];

function formatList(value, max = Infinity) {
  if (!Array.isArray(value)) return '—';
  const flat = value
    .map((v) => {
      if (!v) return null;
      if (typeof v === 'string') return v;
      return (
        v.petitionerName ||
        v.respondentName ||
        v.name ||
        v.advocateName ||
        v.judge ||
        ''
      );
    })
    .filter(Boolean);
  if (flat.length === 0) return '—';
  return flat.slice(0, max).join(', ');
}

function KV({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold text-slate-800 ${
          mono ? 'font-mono text-[12px] uppercase tracking-wide' : ''
        }`}
      >
        {value || '—'}
      </p>
    </div>
  );
}

function PartyBlock({ heading, items, nameKey }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-600">{heading}</p>
      {list.length === 0 ? (
        <p className="mt-1 text-sm text-slate-400">Not listed</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm text-slate-800">
          {list.map((p, i) => {
            const name =
              (p && (p[nameKey] || p.name)) || `${heading} ${i + 1}`;
            const advocate = p && (p.advocate || p.counsel);
            return (
              <li key={`${name}-${i}`}>
                <p className="font-medium">{name}</p>
                {advocate ? (
                  <p className="text-[11px] text-slate-500">
                    Counsel: {advocate}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function UnifiedCasesPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // At-least-one-identifier check — keeps the Search button disabled
  // until the form is actually fillable.
  const canSubmit = useMemo(() => {
    if (!form.courtType) return false;
    return Boolean(
      form.cnr ||
        form.registrationNumber ||
        form.diaryNumber ||
        form.filingNumber
    );
  }, [form]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchUnifiedCase(form);
      setResult(data || {});
    } catch (err) {
      setError(err.message || 'Lookup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm(EMPTY_FORM);
    setError('');
    setResult(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero + form */}
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 py-16 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 -top-24 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-32 h-80 w-80 rounded-full bg-teal-500/15 blur-3xl"
          />

          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                <Sparkles size={13} />
                Powered By Attestr · Unified eCourt
              </span>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Unified <span className="text-gradient-light">case lookup</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
                Search every Indian court jurisdiction — District, High,
                Supreme, Consumer, NCLT, NCLAT, GSTAT, DRT, DRAT — from a
                single form. Pick a court, supply any one identifier, and
                the full case record loads inline.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-10 rounded-3xl border border-white/10 bg-white p-5 shadow-2xl sm:p-7"
            >
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Court type <span className="text-red-500">*</span>
                </span>
                <select
                  value={form.courtType}
                  onChange={(e) => update({ courtType: e.target.value })}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white py-3 px-3.5 text-base text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  <option value="">Select a court type…</option>
                  {COURT_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Required. Defines which identifier fields are valid for the
                  jurisdiction.
                </p>
              </label>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FIELDS.map(({ key, label, placeholder, hint }) => (
                  <label key={key} className="block">
                    <span className="text-xs font-semibold text-slate-600">
                      {label}
                    </span>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => update({ [key]: e.target.value })}
                      placeholder={placeholder}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Provide{' '}
                  <span className="font-semibold text-slate-700">
                    at least one
                  </span>{' '}
                  of CNR / registration / diary / filing number.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    Reset
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!canSubmit || submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Searching…
                      </>
                    ) : (
                      <>
                        <Search size={15} />
                        Search case
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* Result */}
        <section className="bg-slate-50 py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            {error ? (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {submitting ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : result ? (
              result.valid === false ? (
                <Card className="text-center">
                  <Scale className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    No matching case
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {result.message ||
                      'Attestr returned no data for the values you supplied.'}
                  </p>
                </Card>
              ) : (
                <ResultPanel data={result} />
              )
            ) : (
              <Card className="text-center">
                <Landmark className="mx-auto h-12 w-12 text-amber-400" />
                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  Look up a case in any Indian court
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Fill the form above and hit Search. Results pull live from
                  the Attestr Unified eCourt API.
                </p>
              </Card>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

// ResultPanel — renders every documented field on a successful lookup.
// Sections are conditional: anything the upstream omitted simply
// disappears from the page.
function ResultPanel({ data }) {
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const history = Array.isArray(data.caseHistory) ? data.caseHistory : [];
  const acts = Array.isArray(data.acts) ? data.acts : [];
  const transfers = Array.isArray(data.transfers) ? data.transfers : [];
  const linked = Array.isArray(data.linkedCases) ? data.linkedCases : [];
  const documents = Array.isArray(data.documents) ? data.documents : [];
  const objections = Array.isArray(data.objections) ? data.objections : [];
  const iaDetails = Array.isArray(data.interlocutoryApplicationDetails)
    ? data.interlocutoryApplicationDetails
    : [];

  return (
    <div className="space-y-5">
      {/* Title + status */}
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
              CNR {data.cnrNumber || '—'}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              {data.petitionersText || formatList(data.petitioners, 1)}{' '}
              <span className="font-normal text-slate-400">vs</span>{' '}
              <span className="text-slate-800">
                {data.respondentsText || formatList(data.respondents, 1)}
              </span>
            </h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
              String(data.caseStatus || '').toLowerCase().includes('disposed')
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-amber-50 text-amber-700 ring-amber-200'
            }`}
          >
            {data.caseStatus || 'Unknown'}
          </span>
        </div>
      </Card>

      {/* Stats grid */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-800">Case summary</h3>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KV label="Case type" value={data.caseType} />
          <KV label="Filing number" value={data.filingNumber} mono />
          <KV label="Filing date" value={data.filingDate} />
          <KV label="Registration number" value={data.registrationNumber} mono />
          <KV label="Registration date" value={data.registrationDate} />
          <KV label="Case stage" value={data.caseStage} />
          <KV
            label="Court"
            value={data.courtName || data.courtEstablishment}
          />
          <KV
            label="District / State"
            value={
              [data.district, data.state].filter(Boolean).join(', ') || '—'
            }
          />
          <KV
            label="Bench / Judge"
            value={data.courtNumberAndJudge || data.coram || data.bench}
          />
          <KV label="First hearing" value={data.firstHearingDate} />
          <KV label="Previous hearing" value={data.previousHearingDate} />
          <KV label="Next hearing" value={data.nextHearingDate} />
          <KV label="Decision date" value={data.decisionDate} />
          <KV label="Nature of disposal" value={data.natureOfDisposal} />
          <KV label="Judicial" value={data.judicial} />
        </div>
      </Card>

      {/* Parties */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-800">
          Parties &amp; counsel
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PartyBlock
            heading="Petitioner(s)"
            items={data.petitioners}
            nameKey="petitionerName"
          />
          <PartyBlock
            heading="Respondent(s)"
            items={data.respondents}
            nameKey="respondentName"
          />
        </div>
      </Card>

      {/* Acts */}
      {acts.length > 0 ? (
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">
            Acts &amp; sections
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {acts.map((a, i) => {
              const text =
                typeof a === 'string'
                  ? a
                  : a?.actName
                    ? `${a.actName}${a.sections ? ` — ${a.sections}` : ''}`
                    : JSON.stringify(a);
              return (
                <span
                  key={`${text}-${i}`}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                >
                  {text}
                </span>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* History */}
      {history.length > 0 ? (
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">
            Hearing history
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {history.length}
            </span>
          </h3>
          <ol className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
            {history.map((h, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Calendar size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {h.businessOnDate || h.hearingDate || '—'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {h.purpose || h.purposeOfListing || '—'}
                  </p>
                  {h.judge ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      <Gavel
                        size={10}
                        className="mr-1 inline text-slate-400"
                      />
                      {h.judge}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {/* Orders */}
      {orders.length > 0 ? (
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">
            Orders
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              {orders.length}
            </span>
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Order metadata only — the Attestr Unified API doesn&apos;t expose
            order PDFs from this endpoint.
          </p>
          <ul className="mt-3 space-y-2">
            {orders.map((o, i) => (
              <li
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <p className="font-semibold text-slate-900">
                  {o.orderDate || 'Order'}
                </p>
                {o.judge ? (
                  <p className="text-xs text-slate-600">{o.judge}</p>
                ) : null}
                {o.orderType ? (
                  <p className="text-[11px] text-slate-500">{o.orderType}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Interlocutory applications */}
      {iaDetails.length > 0 ? (
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">
            Interlocutory applications
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {iaDetails.length}
            </span>
          </h3>
          <ul className="mt-3 space-y-2">
            {iaDetails.map((ia, i) => (
              <li
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
              >
                <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-700">
                  {JSON.stringify(ia, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Objections */}
      {objections.length > 0 ? (
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">
            Objections ({objections.length})
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            {objections.map((o, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-2.5"
              >
                {typeof o === 'string' ? o : JSON.stringify(o)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* FIR / earlier courts */}
      {data.fir || (data.earlierCourts && data.earlierCourts.length > 0) ? (
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">
            FIR &amp; earlier courts
          </h3>
          {data.fir ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="text-xs font-semibold text-slate-500">FIR</p>
              <p>
                {typeof data.fir === 'string'
                  ? data.fir
                  : JSON.stringify(data.fir)}
              </p>
            </div>
          ) : null}
          {Array.isArray(data.earlierCourts) && data.earlierCourts.length > 0
            ? data.earlierCourts.map((ec, i) => (
                <div
                  key={i}
                  className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                >
                  <p className="text-xs font-semibold text-slate-500">
                    Earlier court #{i + 1}
                  </p>
                  <p>{typeof ec === 'string' ? ec : JSON.stringify(ec)}</p>
                </div>
              ))
            : null}
        </Card>
      ) : null}

      {/* Linked cases + transfers + documents — compact lists */}
      {linked.length + transfers.length + documents.length > 0 ? (
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">
            Linked records
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {linked.length > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Linked cases
                </p>
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {linked.map((l, i) => (
                    <li key={i}>{typeof l === 'string' ? l : JSON.stringify(l)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {transfers.length > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Transfers
                </p>
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {transfers.map((t, i) => (
                    <li key={i}>{typeof t === 'string' ? t : JSON.stringify(t)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {documents.length > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Documents
                </p>
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {documents.map((d, i) => (
                    <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Raw payload toggle — useful for power users / debugging the API. */}
      <details className="group rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 group-open:text-slate-800">
          <span className="flex items-center gap-2">
            <FileText size={13} />
            View raw API response
          </span>
          <ArrowRight
            size={12}
            className="transition-transform group-open:rotate-90"
          />
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-emerald-200">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>

      <div className="text-center text-xs text-slate-500">
        Sourced live from{' '}
        <span className="font-semibold text-amber-700">Attestr</span> · Unified
        eCourt API
      </div>
    </div>
  );
}
