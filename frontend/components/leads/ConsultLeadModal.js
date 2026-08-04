'use client';

// ConsultLeadModal — the attractive popup that every CTA / clickable card on
// the /consult landing page opens. A branded image panel (tagline + trust)
// sits beside the bilingual LandingLeadForm, which runs the full OTP-verified
// flow and redirects to /search?requestVerifed on success.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, BadgeCheck, Lock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LandingLeadForm from '@/components/leads/LandingLeadForm';

export default function ConsultLeadModal({
  open,
  onClose,
  prefillMessage = '',
  source = 'Landing page',
}) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const TRUST = [
    { icon: BadgeCheck, key: 'landing.trust.verified' },
    { icon: Lock, key: 'landing.trust.private' },
    { icon: ShieldCheck, key: 'landing.trust.otp' },
  ];

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('landing.modal.title')}
        onClick={(e) => e.stopPropagation()}
        className="relative grid max-h-[94vh] w-full max-w-3xl grid-cols-1 overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl md:grid-cols-2"
      >
        {/* Branded image / tagline panel */}
        <div
          className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-6 md:flex"
          style={{
            backgroundImage:
              'linear-gradient(160deg, rgba(15,23,42,0.92), rgba(120,53,15,0.82)), url(https://picsum.photos/seed/profirmo-consult/640/900)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/30 blur-3xl animate-pulse-glow"
            aria-hidden="true"
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
              Pro Firmo
            </p>
            <p className="mt-3 text-2xl font-bold leading-tight text-white">
              {t('landing.tagline')}
            </p>
            <p className="mt-2 text-sm text-slate-200">
              {t('landing.modal.caption')}
            </p>
          </div>
          <ul className="relative space-y-2.5">
            {TRUST.map(({ icon: Icon, key }) => (
              <li
                key={key}
                className="flex items-center gap-2 text-sm font-medium text-slate-100"
              >
                <Icon className="h-4 w-4 shrink-0 text-amber-300" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        {/* Form panel */}
        <div className="relative overflow-y-auto p-5 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('profCmp.contactClose')}
            className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
          {/* Mobile-only tagline banner */}
          <div className="mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 px-4 py-3 text-white md:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-100">
              Pro Firmo
            </p>
            <p className="text-lg font-bold leading-tight">
              {t('landing.tagline')}
            </p>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {t('landing.modal.title')}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t('landing.modal.subtitle')}
          </p>
          <div className="mt-4">
            {/* key remounts the form so a new prefill (category) takes effect */}
            <LandingLeadForm
              key={prefillMessage || 'blank'}
              source={source}
              prefillMessage={prefillMessage}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
