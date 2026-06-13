'use client';

// EmployeeHeader — shared chrome for every authenticated /join-team
// page. Brand on the left, primary nav in the middle, employee
// identity + sign-out on the right. Collapses to a hamburger menu
// below the sm breakpoint.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  UserPlus,
  BookOpen,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import {
  getEmployeeProfile,
  clearEmployeeSession,
} from '@/services/employeeAuthService';

const LINKS = [
  { href: '/join-team/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/join-team/onboard', label: 'Onboard pro', icon: UserPlus },
  { href: '/join-team/guide', label: 'Onboarding guide', icon: BookOpen },
  { href: '/join-team/terms', label: 'Terms', icon: FileText },
  { href: '/join-team/privacy', label: 'Privacy', icon: ShieldCheck },
];

export default function EmployeeHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);

  // Read the cached profile on mount so the right-rail avatar +
  // employee code render immediately. We don't refetch from the
  // network — the dashboard does that on its own loop.
  useEffect(() => {
    setMe(getEmployeeProfile());
  }, []);

  function signOut() {
    clearEmployeeSession();
    router.replace('/join-team');
  }

  function isActive(href) {
    if (!pathname) return false;
    if (href === '/join-team/dashboard') return pathname === href;
    return pathname.startsWith(href);
  }

  const initial = (me?.name || me?.email || 'E').trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/join-team/dashboard"
            className="flex items-center gap-2"
          >
            <BrandLogo variant="light" />
            <span className="hidden text-xs font-semibold uppercase tracking-widest text-amber-700 sm:inline">
              Employee
            </span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const Icon = l.icon;
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={14} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {me ? (
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                {initial}
              </div>
              <div className="text-right text-xs leading-tight">
                <p className="font-semibold text-slate-800">{me.name}</p>
                <p className="font-mono text-slate-500">{me.employeeCode}</p>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-600 sm:inline-flex"
          >
            <LogOut size={14} />
            Sign out
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 md:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {open ? (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-3 sm:px-6">
            {me ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 p-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">
                  {initial}
                </div>
                <div className="text-xs leading-tight">
                  <p className="font-semibold text-amber-900">{me.name}</p>
                  <p className="font-mono text-amber-700">{me.employeeCode}</p>
                </div>
              </div>
            ) : null}
            {LINKS.map((l) => {
              const Icon = l.icon;
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={14} />
                  {l.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={signOut}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
