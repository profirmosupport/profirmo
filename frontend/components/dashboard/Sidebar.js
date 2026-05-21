'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Scale,
  LayoutDashboard,
  Search,
  Building2,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { ROLES, SITE } from '@/utils/constants';

const NAV_BY_ROLE = {
  [ROLES.CLIENT]: [
    { label: 'Overview', href: '/dashboard/client', icon: LayoutDashboard },
    { label: 'Find professionals', href: '/professionals', icon: Search },
    { label: 'Browse firms', href: '/firms', icon: Building2 },
  ],
  [ROLES.PROFESSIONAL]: [
    {
      label: 'Overview',
      href: '/dashboard/professional',
      icon: LayoutDashboard,
    },
    { label: 'Find professionals', href: '/professionals', icon: Search },
    { label: 'Browse firms', href: '/firms', icon: Building2 },
  ],
  [ROLES.FIRM_PROFESSIONAL]: [
    {
      label: 'Overview',
      href: '/dashboard/professional',
      icon: LayoutDashboard,
    },
    { label: 'Find professionals', href: '/professionals', icon: Search },
    { label: 'Browse firms', href: '/firms', icon: Building2 },
  ],
  [ROLES.FIRM_ADMIN]: [
    { label: 'Overview', href: '/dashboard/firm', icon: LayoutDashboard },
    { label: 'Find professionals', href: '/professionals', icon: Search },
    { label: 'Browse firms', href: '/firms', icon: Building2 },
  ],
  [ROLES.PLATFORM_ADMIN]: [
    { label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Professionals', href: '/professionals', icon: Users },
    { label: 'Firms', href: '/firms', icon: Building2 },
  ],
};

/**
 * Sidebar — Pro Firmo logo + role-specific navigation.
 * Props: { role, active }
 */
export default function Sidebar({ role }) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE[ROLES.CLIENT];

  function isActive(href) {
    return pathname === href;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Scale size={18} />
        </span>
        <span className="text-lg font-bold text-slate-900">{SITE.name}</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Menu
        </p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft size={18} />
          Back to site
        </Link>
      </div>
    </div>
  );
}
