'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight, Languages, LogIn, UserPlus } from 'lucide-react';
import { NAV_LINKS } from '@/utils/constants';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/components/AuthProvider';
import BrandLogo from '@/components/common/BrandLogo';
import ProfileDropdown from '@/components/common/ProfileDropdown';
import NotificationBell from '@/components/common/NotificationBell';
import CurrentPlanBadge from '@/components/common/CurrentPlanBadge';

const NAV_KEYS = {
  '/professionals': 'nav.professionals',
  '/firms': 'nav.firms',
  '/ecourts': 'nav.eCourts',
  '/blog': 'nav.blog',
  '/how-it-works': 'nav.howItWorks',
  '/pricing': 'nav.pricing',
  '/contact': 'nav.contact',
};

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
  const { isAuthenticated, loading: authLoading } = useAuth();

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
        <BrandLogo />

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
          {authLoading ? (
            <div
              className="h-9 w-28 animate-pulse rounded-xl bg-slate-100"
              aria-hidden="true"
            />
          ) : isAuthenticated ? (
            <>
              <CurrentPlanBadge />
              <NotificationBell />
              <ProfileDropdown />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {t('nav.signIn')}
              </Link>
              <Link
                href="/signup"
                className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition hover:-translate-y-0.5 hover:shadow-glow"
              >
                {t('nav.getStarted')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LangSwitch lang={lang} setLang={setLang} />
          {/* Auth icon buttons on the mobile bar — visible only when the
              visitor isn't signed in. Logged-in users get their profile
              + notification controls inside the menu instead. */}
          {!authLoading && !isAuthenticated && (
            <>
              <Link
                href="/login"
                aria-label={t('nav.signIn')}
                title={t('nav.signIn')}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-teal-300 hover:bg-slate-50"
              >
                <LogIn className="h-5 w-5" />
              </Link>
              <Link
                href="/signup"
                aria-label={t('nav.getStarted')}
                title={t('nav.getStarted')}
                className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-glow-sm transition hover:shadow-glow"
              >
                <UserPlus className="h-5 w-5" />
              </Link>
            </>
          )}
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
          {/* Signed-in users get a dashboard shortcut + profile menu here.
              For signed-out visitors the login/signup CTAs live on the
              mobile header bar above, not in this slide-down panel. */}
          {!authLoading && isAuthenticated && (
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-4">
              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-slate-50"
              >
                {t('nav.dashboard') || 'Dashboard'}
              </Link>
              <div className="flex justify-start">
                <ProfileDropdown />
              </div>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
