'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight, Languages } from 'lucide-react';
import { NAV_LINKS } from '@/utils/constants';
import { useLanguage } from '@/components/LanguageProvider';

const NAV_KEYS = {
  '/professionals': 'nav.professionals',
  '/firms': 'nav.firms',
  '/how-it-works': 'nav.howItWorks',
  '/pricing': 'nav.pricing',
  '/contact': 'nav.contact',
};

function Logo({ onClick }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="group flex items-center gap-2.5"
      aria-label="Pro Firmo home"
    >
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-teal-600 text-white shadow-glow-sm transition group-hover:shadow-glow">
        <span className="text-[13px] font-extrabold tracking-tight">PF</span>
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-white" />
      </span>
      <span className="text-lg font-bold tracking-tight text-slate-900">
        Pro<span className="text-gradient"> Firmo</span>
      </span>
    </Link>
  );
}

function LangSwitch({ lang, setLang, className = '' }) {
  return (
    <div
      className={`flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 ${className}`}
      role="group"
      aria-label="Language"
    >
      <Languages className="ml-1 mr-0.5 h-3.5 w-3.5 text-teal-600" />
      {[
        ['en', 'EN'],
        ['hi', 'हिं'],
      ].map(([code, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            lang === code
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? 'glass border-slate-200/80'
          : 'border-transparent bg-white/70 backdrop-blur-xl'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group relative rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  active
                    ? 'text-amber-700'
                    : 'text-slate-600 hover:text-teal-700'
                }`}
              >
                {t(NAV_KEYS[link.href] || link.label)}
                <span
                  className={`absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-amber-500 to-teal-500 transition-all duration-300 ${
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LangSwitch lang={lang} setLang={setLang} />
          <Link
            href="/auth/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {t('nav.signIn')}
          </Link>
          <Link
            href="/auth/register-client"
            className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition hover:-translate-y-0.5 hover:shadow-glow"
          >
            {t('nav.getStarted')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LangSwitch lang={lang} setLang={setLang} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={t('nav.openMenu')}
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-teal-300 hover:bg-slate-50"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 lg:hidden ${
          open ? 'max-h-[30rem] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
            >
              {t(NAV_KEYS[link.href] || link.label)}
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-4">
            <Link
              href="/auth/login"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-slate-50"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              href="/auth/register-client"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow"
            >
              {t('nav.getStarted')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
