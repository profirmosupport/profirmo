'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Scale,
  Timer,
  Wallet,
  User,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import CallRoom from '@/components/consultation/CallRoom';
import RecordingStatus from '@/components/consultation/RecordingStatus';
import TranscriptPanel from '@/components/consultation/TranscriptPanel';
import ConsultationNotes from '@/components/consultation/ConsultationNotes';
import { useLanguage } from '@/components/LanguageProvider';
import consultationService from '@/services/consultationService';
import { formatCurrency, formatDuration, getInitials } from '@/utils/formatters';
import { SITE } from '@/utils/constants';

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function secondsBetween(start, end) {
  if (!start) return 0;
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  return Math.max(Math.floor((b - a) / 1000), 0);
}

export default function ConsultationPage() {
  const { t } = useLanguage();
  const { consultationId } = useParams();

  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesStatus, setNotesStatus] = useState('');
  const [endingCall, setEndingCall] = useState(false);
  const tickRef = useRef(null);

  // Initial load + auto-start when status is "scheduled".
  useEffect(() => {
    if (!consultationId) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        let c = await consultationService.getById(consultationId);
        if (!c) {
          if (active) setError('Consultation not found.');
          return;
        }
        if (c.callStatus === 'scheduled') {
          // Auto-start so elapsed time is anchored on the server.
          try {
            c = await consultationService.start(consultationId);
          } catch (err) {
            // If start fails (e.g., already ended), surface but keep going.
            if (active) setError(err.message || 'Failed to start consultation.');
          }
        }
        if (!active) return;
        setConsultation(c);
        setNotes(c.notes || '');
      } catch (err) {
        if (active) setError(err.message || 'Failed to load consultation.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [consultationId]);

  // Tick elapsed time from the authoritative server timestamps.
  useEffect(() => {
    if (!consultation) return undefined;
    const compute = () => {
      const status = consultation.callStatus;
      if (status === 'ongoing') {
        setElapsed(secondsBetween(consultation.startedAt, null));
      } else if (status === 'ended') {
        setElapsed(
          consultation.durationMinutes
            ? Number(consultation.durationMinutes) * 60
            : secondsBetween(consultation.startedAt, consultation.endedAt)
        );
      } else {
        setElapsed(0);
      }
    };
    compute();
    if (consultation.callStatus !== 'ongoing') return undefined;
    tickRef.current = setInterval(compute, 1000);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [consultation]);

  const handleEndCall = useCallback(async () => {
    if (!consultationId || endingCall) return;
    setEndingCall(true);
    try {
      const c = await consultationService.end(consultationId);
      setConsultation(c);
    } catch (err) {
      setError(err.message || 'Failed to end consultation.');
    } finally {
      setEndingCall(false);
    }
  }, [consultationId, endingCall]);

  const handleSaveNotes = useCallback(async () => {
    if (!consultationId) return;
    setSavingNotes(true);
    setNotesStatus('');
    try {
      const c = await consultationService.addNotes(consultationId, notes);
      setConsultation(c);
      setNotesStatus('saved');
    } catch (err) {
      setNotesStatus(err.message || 'Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  }, [consultationId, notes]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-100">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Scale size={20} />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-800">
                {SITE.name}
              </span>
            </Link>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-slate-100 lg:col-span-2" />
              <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error && !consultation) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-100">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Scale size={20} />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-800">
                {SITE.name}
              </span>
            </Link>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <Card className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </span>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">
                Something went wrong
              </h2>
              <p className="mt-1 text-sm text-slate-500">{error}</p>
              <div className="mt-5">
                <Button href="/dashboard/client/bookings" variant="primary">
                  Back to my bookings
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const professional = consultation.professional || {};
  const client = consultation.client || {};
  const rate = Number(professional.perMinuteRate) || 0;
  const callEnded = consultation.callStatus === 'ended';
  const billedMinutes = callEnded
    ? Number(consultation.durationMinutes) || Math.ceil(elapsed / 60)
    : Math.ceil(elapsed / 60);
  const runningCost = callEnded
    ? Number(consultation.cost) || billedMinutes * rate
    : billedMinutes * rate;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Minimal top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Scale size={20} />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              {SITE.name}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {callEnded ? (
              <Badge variant="gray">{t('consultPage.callEnded')}</Badge>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t('consultPage.liveConsultation')}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-mono text-sm font-semibold text-slate-700">
              <Timer size={14} className="text-slate-400" />
              {formatElapsed(elapsed)}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main column */}
            <div className="space-y-6 lg:col-span-2">
              {callEnded ? (
                <Card className="text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 size={30} />
                  </span>
                  <h2 className="mt-4 text-xl font-bold text-slate-900">
                    {t('consultPage.consultationEnded')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('consultPage.summaryIntro', {
                      name: professional.name || '—',
                    })}
                  </p>

                  <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <dt className="text-xs text-slate-500">
                        {t('consultPage.totalDuration')}
                      </dt>
                      <dd className="mt-1 text-lg font-bold text-slate-900">
                        {formatDuration(billedMinutes)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <dt className="text-xs text-slate-500">
                        {t('consultPage.totalCost')}
                      </dt>
                      <dd className="mt-1 text-lg font-bold text-slate-900">
                        {formatCurrency(runningCost)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6">
                    <Button href="/dashboard/client" size="lg">
                      {t('consultPage.backToDashboard')}
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card padding={false} className="p-4 sm:p-5">
                  <CallRoom
                    professional={professional}
                    client={client}
                    onEndCall={handleEndCall}
                  />
                  {endingCall && (
                    <p className="mt-3 text-center text-xs text-slate-500">
                      Ending call…
                    </p>
                  )}
                </Card>
              )}

              {/* Billing strip */}
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Timer size={18} />
                    </span>
                    <div>
                      <p className="text-xs text-slate-500">
                        {t('consultPage.elapsedTime')}
                      </p>
                      <p className="font-mono text-base font-semibold text-slate-900">
                        {formatElapsed(elapsed)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Wallet size={18} />
                    </span>
                    <div>
                      <p className="text-xs text-slate-500">
                        {t('consultPage.runningCost', {
                          count: billedMinutes,
                        })}
                      </p>
                      <p className="text-base font-semibold text-slate-900">
                        {formatCurrency(runningCost)}
                      </p>
                    </div>
                  </div>

                  <RecordingStatus recording={!callEnded} />
                </div>
              </Card>
            </div>

            {/* Side panel */}
            <div className="space-y-6 lg:col-span-1">
              {/* Client detail */}
              <Card>
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('consultPage.client')}
                </h3>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                    {getInitials(client.name || '?')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {client.name || '—'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {client.city || ''}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      {t('consultPage.email')}
                    </dt>
                    <dd className="truncate font-medium text-slate-700">
                      {client.email || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      {t('consultPage.phone')}
                    </dt>
                    <dd className="font-medium text-slate-700">
                      {client.phone || '—'}
                    </dd>
                  </div>
                </dl>
              </Card>

              {/* Professional detail */}
              <Card>
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('consultPage.professional')}
                </h3>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {getInitials(professional.name || '?')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {professional.name || '—'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {professional.professionType || ''}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <Briefcase size={12} />
                      {t('consultPage.specialization')}
                    </dt>
                    <dd className="truncate font-medium text-slate-700">
                      {professional.specialization || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <User size={12} />
                      {t('consultPage.city')}
                    </dt>
                    <dd className="font-medium text-slate-700">
                      {professional.city || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">{t('consultPage.rate')}</dt>
                    <dd className="font-medium text-slate-700">
                      {t('consultPage.ratePerMin', {
                        amount: formatCurrency(rate),
                      })}
                    </dd>
                  </div>
                </dl>
              </Card>

              <TranscriptPanel transcript={consultation.transcript} />

              <ConsultationNotes
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onSave={handleSaveNotes}
              />
              {savingNotes && (
                <p className="text-xs text-slate-500">Saving…</p>
              )}
              {notesStatus === 'saved' && !savingNotes && (
                <p className="text-xs text-emerald-600">Notes saved.</p>
              )}
              {notesStatus && notesStatus !== 'saved' && !savingNotes && (
                <p className="text-xs text-red-600">{notesStatus}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
