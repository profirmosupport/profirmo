'use client';

// LeadGenFloater — small wrapper that renders only the collapsed pill in
// the initial bundle and lazily fetches the heavier form panel
// (LeadGenFloaterForm) the first time the user clicks the pill. Once
// submitted the floater stays in "thanks" mode for the session.
//
// Bundle behaviour:
//   - Initial chunk: this file + MessageCircle/CheckCircle2 icons (~2 KB).
//   - Form chunk:    LeadGenFloaterForm + X/Send/Loader2 icons + the fetch
//                    logic (~6-8 KB), dynamically imported on first open.

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MessageCircle, CheckCircle2 } from 'lucide-react';

// `ssr: false` — the form is interactive only and the closed pill is what
// matters for first paint. Suspense with `loading: null` keeps the
// open-click silent until the chunk arrives (typically <200 ms on a warm
// connection).
const LeadGenFloaterForm = dynamic(() => import('./LeadGenFloaterForm'), {
  ssr: false,
  loading: () => null,
});

const STORAGE_KEY = 'pf_lead_floater_submitted';

export default function LeadGenFloater({ source = 'cms-floater' }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Don't show the form on every page if the visitor already submitted
  // earlier in this browser session. Re-engagement happens via the
  // pf_lead cookie the backend already sets (/api/leads/me reads it).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') setSubmitted(true);
    } catch {}
  }, []);

  function handleSubmitted() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-lg sm:bottom-6 sm:right-6">
        <CheckCircle2 size={14} />
        We&apos;ll be in touch shortly.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-700 sm:bottom-6 sm:right-6"
        aria-label="Get a free callback"
      >
        <MessageCircle size={16} />
        <span className="hidden sm:inline">Get a free callback</span>
        <span className="sm:hidden">Callback</span>
      </button>
    );
  }

  return (
    <LeadGenFloaterForm
      source={source}
      onClose={() => setOpen(false)}
      onSubmitted={handleSubmitted}
    />
  );
}
