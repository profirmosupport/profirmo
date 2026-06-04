'use client';

// Case detail page — pulls /api/ecourts/case/[cnr] and renders the
// full picture: parties, courtroom history, interim orders, judgments.
// The Download button on each order hits the backend's PDF stream
// endpoint which decodes the watermarked PDF from upstream base64.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  FolderPlus,
  Gavel,
  Loader2,
  Lock,
  LogIn,
  MapPin,
  Scale,
  Sparkles,
  Users2,
} from 'lucide-react';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import {
  getCaseByCnr,
  getImportedCase,
  importCaseFromEcourts,
  orderDownloadUrl,
} from '@/services/ecourtsService';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function StatBlock({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-800">
        {value || '—'}
      </span>
    </div>
  );
}

function PartyList({ label, items, icon: Icon, accent }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon size={14} />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </h3>
      </div>
      {list.length === 0 ? (
        <p className="ml-9 mt-1 text-sm text-slate-400">Not listed</p>
      ) : (
        <ul className="ml-9 mt-1 space-y-0.5 text-sm text-slate-800">
          {list.map((name, i) => (
            <li key={`${name}-${i}`}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ order, cnr, downloading, onDownload }) {
  const filename = order.orderUrl || order.filename;
  const label = order.orderType || order.description || 'Order';
  const id = `${order.orderDate || ''}|${filename || ''}`;
  const isBusy = downloading === id;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-amber-300 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {order.orderDate ? (
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} className="text-slate-400" />
              {fmtDate(order.orderDate)}
            </span>
          ) : null}
          {filename ? (
            <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
              {filename}
            </span>
          ) : null}
        </div>
      </div>
      {filename ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => onDownload(id, filename)}
          disabled={isBusy}
        >
          {isBusy ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Fetching…
            </>
          ) : (
            <>
              <Download size={14} />
              Download PDF
            </>
          )}
        </Button>
      ) : (
        <span className="text-xs text-slate-400">No file</span>
      )}
    </div>
  );
}

export default function ECourtsCaseDetailPage() {
  const { cnr } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Back-link context — when the user arrived here from a saved case in
  // their dashboard ("Update from E-Court"), we swap the default
  // "Back to search" for "Back to case" pointing at the same dashboard
  // row. Only accept whitelisted prefixes so the param can't be abused
  // to bounce to an arbitrary URL.
  const fromParam = (searchParams && searchParams.get('from')) || '';
  const fromIsSavedCase =
    fromParam.startsWith('/dashboard/') && fromParam.includes('/cases/');
  const backHref = fromIsSavedCase ? fromParam : '/ecourts';
  const backLabel = fromIsSavedCase ? 'Back to case' : 'Back to search';
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');
  // Imported-case state — when the signed-in user has already saved this
  // CNR, we swap the "Save to my cases" CTA for a "Check in my cases"
  // link pointing at the relevant dashboard. `imported.caseId` is the
  // id of the row to deep-link to.
  const [imported, setImported] = useState({
    imported: false,
    caseId: null,
    role: null,
  });
  const [actionBusy, setActionBusy] = useState(''); // 'import'
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (!cnr) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getCaseByCnr(cnr);
      setCaseData(data || null);
    } catch (err) {
      if (err && err.status === 401) {
        // Stale token — kick out to login, preserve return path.
        router.push(
          `/login?next=${encodeURIComponent(`/ecourts/${cnr}`)}`
        );
        return;
      }
      setError(err.message || 'Failed to load case.');
    } finally {
      setLoading(false);
    }
  }, [cnr, isAuthenticated, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Check whether this CNR is already in the user's Cases module.
  useEffect(() => {
    if (!isAuthenticated || !cnr) return;
    let active = true;
    (async () => {
      try {
        const r = await getImportedCase(cnr);
        if (active) setImported(r);
      } catch {
        /* silent — non-critical */
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, cnr]);

  function dashboardHrefFor(caseId, role) {
    if (!caseId) return null;
    return String(role || '').toLowerCase() === 'professional'
      ? `/dashboard/professional/cases/${caseId}`
      : `/dashboard/client/cases/${caseId}`;
  }

  async function importToCases() {
    if (actionBusy) return;
    setActionBusy('import');
    setActionError('');
    try {
      const result = await importCaseFromEcourts(cnr);
      const newCase = result && result.case;
      const role = String(user?.role || '').toLowerCase();
      // Flip the CTA into the "Check in my cases" state — no extra round
      // trip needed; we have everything from the import response.
      setImported({
        imported: true,
        caseId: newCase && newCase.id,
        role,
      });
    } catch (err) {
      setActionError(
        err.message ||
          (err.code === 'PLAN_LIMIT_REACHED'
            ? 'Your subscription plan does not allow more cases.'
            : 'Failed to save this case.')
      );
    } finally {
      setActionBusy('');
    }
  }

  // Trigger a real PDF download. We hit the proxy in a fetch so we can
  // surface backend errors inline (the upstream `order-md` call can take
  // 30s–5min on a cold order). Once we have the blob we feed it to a
  // hidden <a download> click for a clean save dialog.
  async function handleDownload(id, filename) {
    setDownloadError('');
    setDownloading(id);
    try {
      const url = orderDownloadUrl(cnr, filename);
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        let msg = `Download failed (${res.status}).`;
        try {
          const txt = await res.text();
          const j = JSON.parse(txt);
          if (j && j.message) msg = j.message;
        } catch {
          /* keep generic msg */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      // Pull the server-suggested filename out of Content-Disposition.
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const saveAs = match ? match[1] : `${cnr}-${filename}`;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = saveAs;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      setDownloadError(err.message || 'Download failed.');
    } finally {
      setDownloading('');
    }
  }

  const courtData = (caseData && caseData.courtCaseData) || null;
  const interim = Array.isArray(courtData?.interimOrders)
    ? courtData.interimOrders
    : [];
  const judgments = Array.isArray(courtData?.judgmentOrders)
    ? courtData.judgmentOrders
    : [];
  const hearings = Array.isArray(courtData?.historyOfCaseHearings)
    ? courtData.historyOfCaseHearings
    : [];

  // --- Auth gate -----------------------------------------------------------
  // Detail / download / save actions all require a signed-in account.
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <Card className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Lock size={22} />
              </span>
              <h1 className="mt-4 text-2xl font-bold text-slate-900">
                Sign in to view this case
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                Detailed E-Courts records — including parties, hearings and
                downloadable orders — are available only to Profirmo members.
                It takes a minute to sign up.
              </p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-slate-400">
                CNR {cnr}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  href={`/login?next=${encodeURIComponent(`/ecourts/${cnr}${fromIsSavedCase ? `?from=${encodeURIComponent(fromParam)}` : ''}`)}`}
                  variant="primary"
                >
                  <LogIn size={16} />
                  Sign in
                </Button>
                <Button
                  href={`/signup?next=${encodeURIComponent(`/ecourts/${cnr}${fromIsSavedCase ? `?from=${encodeURIComponent(fromParam)}` : ''}`)}`}
                  variant="outline"
                >
                  Create an account
                </Button>
                <Button href={backHref} variant="ghost">
                  {backLabel}
                </Button>
              </div>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        {/* Hero header */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-amber-700"
            >
              <ArrowLeft size={13} />
              {backLabel}
            </Link>
            {loading ? (
              <div className="mt-4 h-10 w-2/3 animate-pulse rounded-lg bg-slate-100" />
            ) : courtData ? (
              <>
                <div className="mt-3 flex flex-wrap items-baseline gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {(courtData.petitioners && courtData.petitioners[0]) ||
                      courtData.cnr}
                    {courtData.respondents && courtData.respondents[0] ? (
                      <>
                        {' '}
                        <span className="font-normal text-slate-400">vs</span>{' '}
                        <span className="text-slate-800">
                          {courtData.respondents[0]}
                        </span>
                      </>
                    ) : null}
                  </h1>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                    {courtData.caseStatus || 'Unknown'}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs uppercase tracking-widest text-slate-400">
                  CNR {courtData.cnr}
                </p>
              </>
            ) : null}

            {/* Action toolbar — single CTA. While the case isn't saved
                yet: "Save to my cases" (subscription-gated server-side
                for professionals via canCreateCase). Once saved: swap
                to a "Check in my cases" link pointing at the dashboard
                row, so a returning user can jump straight to it. */}
            {!loading && caseData ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {imported.imported && imported.caseId ? (
                  <Link
                    href={
                      dashboardHrefFor(imported.caseId, imported.role) || '#'
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <CheckCircle2 size={14} />
                    Check in my cases
                    <ArrowRight size={13} className="text-emerald-600" />
                  </Link>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={importToCases}
                    disabled={actionBusy === 'import'}
                  >
                    {actionBusy === 'import' ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <FolderPlus size={14} />
                        Save to my cases
                      </>
                    )}
                  </Button>
                )}
                {actionError ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                    <AlertCircle size={12} />
                    {actionError}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          {error ? (
            <EmptyState
              icon={<AlertCircle size={24} />}
              title="Could not load case"
              description={error}
              action={
                <Button variant="primary" onClick={load}>
                  Try again
                </Button>
              }
            />
          ) : loading ? (
            <>
              <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            </>
          ) : courtData ? (
            <>
              {/* Quick stats */}
              <Card>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatBlock label="Case type" value={courtData.caseType} />
                  <StatBlock label="Case number" value={courtData.caseNumber} />
                  <StatBlock
                    label="Court"
                    value={courtData.courtName || courtData.courtCode}
                  />
                  <StatBlock
                    label="District / State"
                    value={
                      [courtData.district, courtData.state]
                        .filter(Boolean)
                        .join(', ') || '—'
                    }
                  />
                  <StatBlock
                    label="Filed on"
                    value={fmtDate(courtData.filingDate)}
                  />
                  <StatBlock
                    label="Registered on"
                    value={fmtDate(courtData.registrationDate)}
                  />
                  <StatBlock
                    label="Decision date"
                    value={fmtDate(courtData.decisionDate)}
                  />
                  <StatBlock
                    label="Next hearing"
                    value={fmtDate(courtData.nextHearingDate)}
                  />
                </div>
                {Array.isArray(courtData.actsAndSections) &&
                courtData.actsAndSections.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Acts & sections
                    </span>
                    {courtData.actsAndSections.map((act, i) => (
                      <span
                        key={`${act}-${i}`}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {act}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Card>

              {/* Parties + counsel */}
              <Card>
                <h2 className="text-sm font-semibold text-slate-800">
                  Parties & counsel
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <PartyList
                    label="Petitioner(s)"
                    items={courtData.petitioners}
                    icon={Users2}
                    accent="bg-amber-100 text-amber-700"
                  />
                  <PartyList
                    label="Respondent(s)"
                    items={courtData.respondents}
                    icon={Users2}
                    accent="bg-rose-100 text-rose-700"
                  />
                  <PartyList
                    label="Petitioner's advocates"
                    items={courtData.petitionerAdvocates}
                    icon={Briefcase}
                    accent="bg-sky-100 text-sky-700"
                  />
                  <PartyList
                    label="Respondent's advocates"
                    items={courtData.respondentAdvocates}
                    icon={Briefcase}
                    accent="bg-emerald-100 text-emerald-700"
                  />
                  <PartyList
                    label="Judges"
                    items={courtData.judges}
                    icon={Gavel}
                    accent="bg-violet-100 text-violet-700"
                  />
                </div>
              </Card>

              {/* Hearings history */}
              {hearings.length > 0 ? (
                <Card>
                  <h2 className="text-sm font-semibold text-slate-800">
                    Hearing history
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {hearings.length}
                    </span>
                  </h2>
                  <ol className="mt-4 space-y-3">
                    {hearings.slice(0, 25).map((h, i) => (
                      <li
                        key={`${h.hearingDate || ''}-${i}`}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <Calendar size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {fmtDate(h.hearingDate)}
                          </p>
                          <p className="text-xs text-slate-600">
                            {h.purposeOfListing || h.purpose || '—'}
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

              {/* Orders + judgments */}
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Orders & judgments
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                      {interim.length + judgments.length}
                    </span>
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Downloads stream a watermarked true-copy PDF directly from
                  ecourtsindia.com. First fetch can take 30 seconds — please
                  don't close the tab.
                </p>

                {downloadError ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{downloadError}</span>
                  </div>
                ) : null}

                {interim.length + judgments.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No orders have been published for this case yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-5">
                    {judgments.length > 0 ? (
                      <div>
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Judgments
                        </h3>
                        <div className="space-y-2">
                          {judgments.map((order, i) => (
                            <OrderRow
                              key={`j-${order.orderUrl}-${i}`}
                              order={order}
                              cnr={cnr}
                              downloading={downloading}
                              onDownload={handleDownload}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {interim.length > 0 ? (
                      <div>
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Interim orders
                        </h3>
                        <div className="space-y-2">
                          {interim.map((order, i) => (
                            <OrderRow
                              key={`i-${order.orderUrl}-${i}`}
                              order={order}
                              cnr={cnr}
                              downloading={downloading}
                              onDownload={handleDownload}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>

              {/* Footer link */}
              <div className="text-center text-xs text-slate-500">
                Powered By{' '}
                <span className="font-semibold text-amber-700">
                  E-Courts India
                </span>{' '}
                · Last refreshed just now
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Scale size={24} />}
              title="Case not found"
              description="We couldn't find a case with this CNR. Try the search again."
              action={
                <Button href={backHref} variant="primary">
                  {backLabel}
                </Button>
              }
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
