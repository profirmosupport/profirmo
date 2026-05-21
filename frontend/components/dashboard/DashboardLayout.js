'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X, Bell, LogOut } from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Button from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/utils/formatters';

/**
 * DashboardLayout — app shell with sticky sidebar, top bar and content area.
 * Props: { children, role, title, subtitle }
 */
export default function DashboardLayout({ children, role, title, subtitle }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleLogout() {
    logout();
    router.push('/');
  }

  const displayName = user && user.name ? user.name : 'Guest user';
  const displayEmail = user && user.email ? user.email : '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <Sidebar role={role} />
      </aside>

      {/* Mobile drawer */}
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
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <Sidebar role={role} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
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
              <button
                type="button"
                aria-label="Notifications"
                className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
              >
                <Bell size={19} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600" />
              </button>

              <div className="hidden items-center gap-2.5 sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                  {getInitials(displayName)}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-slate-800">
                    {displayName}
                  </p>
                  {displayEmail && (
                    <p className="text-xs text-slate-500">{displayEmail}</p>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
