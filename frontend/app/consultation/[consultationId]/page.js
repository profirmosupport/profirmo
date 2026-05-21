'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Scale,
  Timer,
  Wallet,
  User,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import CallRoom from '@/components/consultation/CallRoom';
import RecordingStatus from '@/components/consultation/RecordingStatus';
import TranscriptPanel from '@/components/consultation/TranscriptPanel';
import ConsultationNotes from '@/components/consultation/ConsultationNotes';
import {
  consultations,
  clients,
  getProfessionalById,
} from '@/data/mockData';
import {
  formatCurrency,
  formatDuration,
  getInitials,
} from '@/utils/formatters';
import { SITE } from '@/utils/constants';

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function ConsultationPage() {
  const { consultationId } = useParams();

  const consultation =
    consultations.find((c) => c.id === consultationId) || consultations[0];
  const professional =
    getProfessionalById(consultation.professionalId) ||
    getProfessionalById('pro-1');
  const client =
    clients.find((c) => c.id === consultation.clientId) || clients[0];

  const rate = professional ? Number(professional.perMinuteRate) || 0 : 0;

  const [elapsed, setElapsed] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const [notes, setNotes] = useState(consultation.notes || '');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (callEnded) return undefined;
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [callEnded]);

  function handleEndCall() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCallEnded(true);
  }

  const billedMinutes = Math.ceil(elapsed / 60);
  const runningCost = billedMinutes * rate;

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
              <Badge variant="gray">Call ended</Badge>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live consultation
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
                    Consultation ended
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Here is a summary of your session with {professional.name}.
                  </p>

                  <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <dt className="text-xs text-slate-500">
                        Total duration
                      </dt>
                      <dd className="mt-1 text-lg font-bold text-slate-900">
                        {formatDuration(billedMinutes)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <dt className="text-xs text-slate-500">Total cost</dt>
                      <dd className="mt-1 text-lg font-bold text-slate-900">
                        {formatCurrency(runningCost)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6">
                    <Button href="/dashboard/client" size="lg">
                      Back to dashboard
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
                      <p className="text-xs text-slate-500">Elapsed time</p>
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
                        Running cost ({billedMinutes} min)
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
                  Client
                </h3>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                    {getInitials(client.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {client.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {client.city}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="truncate font-medium text-slate-700">
                      {client.email}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="font-medium text-slate-700">
                      {client.phone}
                    </dd>
                  </div>
                </dl>
              </Card>

              {/* Professional detail */}
              <Card>
                <h3 className="text-sm font-semibold text-slate-800">
                  Professional
                </h3>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {getInitials(professional.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {professional.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {professional.professionType}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <Briefcase size={12} />
                      Specialization
                    </dt>
                    <dd className="truncate font-medium text-slate-700">
                      {professional.specialization}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <User size={12} />
                      City
                    </dt>
                    <dd className="font-medium text-slate-700">
                      {professional.city}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Rate</dt>
                    <dd className="font-medium text-slate-700">
                      {formatCurrency(rate)}/min
                    </dd>
                  </div>
                </dl>
              </Card>

              <TranscriptPanel transcript={consultation.transcript} />

              <ConsultationNotes
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onSave={() => {}}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
