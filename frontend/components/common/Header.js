'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ArrowRight,
  Languages,
  LogIn,
  UserPlus,
  LayoutDashboard,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { NAV_LINKS } from '@/utils/constants';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/components/AuthProvider';
import BrandLogo from '@/components/common/BrandLogo';
// ProfileDropdown is used on the desktop bar; the mobile slide-down
// uses explicit Dashboard / Logout buttons.
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
  '/services': 'nav.knowledge',
};

const NAV_LABEL_KEYS = {
  Knowledge: 'nav.knowledge',
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

// Desktop hover-and-click dropdown for the Knowledge menu. The first three
// items in the data file are "feature" links (All services, Blog, How it
// works) shown in a top panel; the rest render as a 2-column service grid
// below. Closes on outside-click and on Escape.
function KnowledgeDropdown({ label, items, pathname }) {
  const [open, setOpen] = useState(false);
  // First 3 items render as featured cards (All services / Blog / How it
  // works); the remaining items fill a 2-column service grid below.
  const featured = items.slice(0, 3);
  const services = items.slice(3);

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Close when the route changes (parent passes pathname).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const anyActive = items.some((i) => pathname === i.href);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`group relative inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
          anyActive
            ? 'text-amber-700'
            : 'text-slate-600 hover:text-teal-700'
        }`}
      >
        {label}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
        <span
          className={`absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-amber-500 to-teal-500 transition-all duration-300 ${
            anyActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 w-[640px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          {/* Featured row */}
          <ul className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-3">
            {featured.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="flex flex-col rounded-lg px-3 py-2 transition hover:bg-amber-50"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-sm font-semibold text-slate-900">
                    {it.label}
                  </span>
                  {it.description ? (
                    <span className="mt-0.5 text-[11px] leading-snug text-slate-500">
                      {it.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {/* Service grid */}
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {services.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
                  onClick={() => setOpen(false)}
                >
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Mobile inline-expand panel for Knowledge. Renders the same items as the
// desktop dropdown but stacked, with a chevron toggle.
function MobileKnowledgeGroup({ label, items }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul className="mb-2 ml-2 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className="block rounded-lg px-3 py-2 text-[13px] text-slate-600 transition hover:bg-amber-50 hover:text-amber-700"
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { lang, setLang, t } = useLanguage();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();

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
            if (link.dropdown) {
              return (
                <KnowledgeDropdown
                  key={link.key || link.label}
                  label={t(NAV_LABEL_KEYS[link.label] || link.label)}
                  items={link.dropdown}
                  pathname={pathname}
                />
              );
            }
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
          {NAV_LINKS.map((link) => {
            if (link.dropdown) {
              return (
                <MobileKnowledgeGroup
                  key={link.key || link.label}
                  label={t(NAV_LABEL_KEYS[link.label] || link.label)}
                  items={link.dropdown}
                />
              );
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
              >
                {t(NAV_KEYS[link.href] || link.label)}
              </Link>
            );
          })}
          {/* Signed-in users get explicit Dashboard + Logout buttons.
              For signed-out visitors the login/signup CTAs live on the
              mobile header bar above, not in this slide-down panel. */}
          {!authLoading && isAuthenticated && (
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-slate-50"
              >
                <LayoutDashboard className="h-4 w-4" />
                {t('nav.dashboard')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout?.();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {t('nav.logout')}
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
