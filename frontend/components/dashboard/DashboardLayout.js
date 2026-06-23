'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, Wallet, BellPlus } from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import BrandLogo from '@/components/common/BrandLogo';
import ProfileDropdown from '@/components/common/ProfileDropdown';
import NotificationBell from '@/components/common/NotificationBell';
import AddReminderModal from '@/components/dashboard/AddReminderModal';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/hooks/useAuth';
import { ROLES } from '@/utils/constants';
import { getPref, setPref } from '@/services/userPreferenceService';

/**
 * DashboardLayout — app shell with sticky sidebar, top bar and content area.
 * Guards the route: unauthenticated visitors are redirected to /login.
 * Props: { children, role, title, subtitle }
 */
export default function DashboardLayout({ children, role, title, subtitle }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { loading, isAuthenticated, user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  // Desktop sidebar collapse state — persisted per-user via the
  // user_preferences kv store so the choice survives across sessions
  // and devices.
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) return undefined;
    (async () => {
      try {
        const v = await getPref('sidebar_collapsed');
        if (!cancelled && typeof v === 'boolean') setSidebarCollapsedState(v);
      } catch {
        // No pref yet → keep the expanded default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  function toggleSidebarCollapsed() {
    const next = !sidebarCollapsed;
    setSidebarCollapsedState(next);
    setPref('sidebar_collapsed', next).catch(() => {});
  }
  // Wallet quick-link + Add reminder shortcut are only relevant to
  // professionals (both standalone + firm-attached). Other roles keep
  // the existing two-item header.
  const isProfessional =
    user &&
    (user.role === ROLES.PROFESSIONAL ||
      user.role === ROLES.FIRM_PROFESSIONAL);
  const showWalletShortcut = isProfessional;
  const showReminderShortcut = isProfessional;

  // Route guard — once auth has resolved, bounce guests to the login page.
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  // While auth is resolving (or while redirecting), show a branded
  // loader. Replaces the older grey-skeleton flash that made
  // page-refresh feel like a sign-out + sign-in. Distinct copy
  // depending on whether we're still resolving (loading) or
  // bouncing to /login.
  if (loading || !isAuthenticated) {
    const message = loading ? 'Loading your dashboard…' : 'Redirecting…';
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-amber-50/40">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-14 w-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/profirmo-logo.png"
              alt="Pro Firmo"
              width={56}
              height={56}
              className="h-full w-full object-contain"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1 animate-ping rounded-full bg-amber-400/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 animate-bounce rounded-full bg-amber-500"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="inline-block h-2 w-2 animate-bounce rounded-full bg-amber-500"
              style={{ animationDelay: '120ms' }}
            />
            <span
              className="inline-block h-2 w-2 animate-bounce rounded-full bg-amber-500"
              style={{ animationDelay: '240ms' }}
            />
          </div>
          <p className="text-sm font-medium text-slate-600">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar — width toggles between w-16 (collapsed,
          icon-only) and w-64 (full). Width drives the lg:pl-* on the
          content shell below so the page widens with the sidebar. */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <Sidebar
          role={role}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      </aside>

      {/* Mobile drawer — always renders expanded; the collapse toggle
          only makes sense on the desktop rail where horizontal real
          estate is fixed. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={t('dash.layout.closeMenu')}
              className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <Sidebar role={role} />
          </div>
        </div>
      )}

      <div
        className={`transition-[padding] duration-200 ${
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label={t('dash.layout.openMenu')}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-slate-900">
                  {title}
                </h1>
                {subtitle && (
                  <p className="truncate text-sm text-slate-500">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {showReminderShortcut && (
                <button
                  type="button"
                  onClick={() => setReminderOpen(true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                  title="Add a reminder"
                >
                  <BellPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add reminder</span>
                </button>
              )}
              {showWalletShortcut && (
                <Link
                  href="/dashboard/professional/wallet"
                  title="Wallet"
                  aria-label="Wallet"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 hover:text-amber-700"
                >
                  <Wallet className="h-4 w-4" />
                </Link>
              )}
              <NotificationBell />
              <ProfileDropdown />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {showReminderShortcut && (
        <AddReminderModal
          open={reminderOpen}
          onClose={() => setReminderOpen(false)}
        />
      )}
    </div>
  );
}
