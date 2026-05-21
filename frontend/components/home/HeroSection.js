'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  Star,
  Send,
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const TRUST_AVATARS = [12, 32, 45, 56, 68];

const FLOAT_CARDS = [
  {
    img: 26,
    name: 'Priya Nair',
    role: 'Property Lawyer',
    rating: '4.9',
    pos: 'left-2 top-16 sm:-left-10',
    anim: 'animate-float',
  },
  {
    img: 51,
    name: 'Rohan Kapoor',
    role: 'GST Consultant',
    rating: '4.8',
    pos: 'bottom-10 right-2 sm:-right-8',
    anim: 'animate-float-slow',
  },
];

export default function HeroSection() {
  const router = useRouter();
  const { t } = useLanguage();
  const [issue, setIssue] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    router.push('/professionals');
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-white to-teal-50 pb-24 pt-16 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-amber-400/30 blur-3xl animate-pulse-glow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-0 top-40 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl animate-float-slow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-teal-300/25 blur-3xl animate-float"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* LEFT */}
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-200">
            <Sparkles className="h-3.5 w-3.5" />
            {t('hero.eyebrow')}
          </span>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            {t('hero.headingLead')}{' '}
            <span className="text-gradient">{t('hero.headingHighlight')}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            {t('hero.subtext')}
          </p>

          {/* Describe-your-case entry */}
          <form
            onSubmit={handleSubmit}
            className="glass mt-8 flex flex-col gap-2 rounded-2xl p-2 shadow-card sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
              <input
                type="text"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder={t('hero.inputPlaceholder')}
                aria-label={t('hero.inputAria')}
                className="w-full rounded-xl bg-transparent py-3 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none"
              />
            </div>
            <button
              type="submit"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-glow-sm transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              <Send className="h-4 w-4" />
              {t('hero.matchButton')}
            </button>
          </form>

          <Link
            href="/professionals"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
          >
            {t('hero.browseLink')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          {/* Trust row */}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex -space-x-3">
              {TRUST_AVATARS.map((n) => (
                <span
                  key={n}
                  className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 ring-2 ring-white"
                >
                  <img
                    src={`https://i.pravatar.cc/80?img=${n}`}
                    alt={t('hero.trustAvatarAlt')}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </span>
              ))}
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-900">
                {t('hero.trustHeadline')}
              </p>
              <div className="flex items-center gap-1 text-slate-500">
                <span className="flex">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                    />
                  ))}
                </span>
                <span className="font-medium">4.9/5</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — AI chat preview */}
        <div className="relative animate-fade-up [animation-delay:120ms]">
          <div
            className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-500/20 via-amber-400/15 to-teal-400/20 blur-2xl"
            aria-hidden="true"
          />

          {/* Framed stock-photo accent */}
          <div className="absolute -right-4 -top-12 hidden w-44 rotate-3 lg:block">
            <div className="rounded-2xl border border-white bg-gradient-to-br from-amber-100 to-teal-100 p-1.5 shadow-card-lg">
              <div className="overflow-hidden rounded-xl bg-slate-200">
                <img
                  src="https://picsum.photos/seed/profirmo-hero/440/320"
                  alt={t('hero.framedAlt')}
                  loading="lazy"
                  className="h-32 w-full object-cover"
                />
              </div>
              <p className="px-1 py-1.5 text-[11px] font-semibold text-slate-700">
                {t('hero.framedCaption')}
              </p>
            </div>
          </div>

          <div className="glass rounded-3xl p-5 shadow-card-lg">
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-slate-200/70 pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-glow-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {t('hero.assistantName')}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {t('hero.assistantOnline')}
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </div>

            {/* Chat bubbles */}
            <div className="space-y-3 pt-4">
              <div className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm text-white shadow-glow-sm">
                  {t('hero.chatUser')}
                </p>
              </div>
              <div className="flex justify-start">
                <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
                  {t('hero.chatBotLead')}{' '}
                  <span className="font-semibold text-indigo-600">
                    {t('hero.chatBotMatch')}
                  </span>{' '}
                  {t('hero.chatBotTail')}
                </p>
              </div>

              {/* Typing indicator */}
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full bg-indigo-400 animate-typing"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-50/70 px-3 py-2.5 text-xs text-indigo-700">
              <ShieldCheck className="h-4 w-4" />
              {t('hero.verifiedNote')}
            </div>
          </div>

          {/* Floating mini cards */}
          {FLOAT_CARDS.map((c) => (
            <div
              key={c.name}
              className={`glass absolute hidden items-center gap-2.5 rounded-2xl p-2.5 shadow-card sm:flex ${c.pos} ${c.anim}`}
            >
              <span className="h-10 w-10 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 ring-2 ring-white">
                <img
                  src={`https://i.pravatar.cc/80?img=${c.img}`}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </span>
              <div className="pr-1">
                <p className="flex items-center gap-1 text-xs font-semibold text-slate-900">
                  {c.name}
                  <BadgeCheck className="h-3.5 w-3.5 text-indigo-500" />
                </p>
                <p className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {c.rating} · {c.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
