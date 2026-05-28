'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Building2,
  Users,
  ShieldCheck,
  ScrollText,
  Star,
  Flag,
  Briefcase,
  CalendarClock,
  FolderKanban,
  UserCircle,
  UserPlus,
  ArrowLeft,
  ChevronRight,
  Settings,
  ListTree,
  MapPin,
  Inbox,
  TrendingUp,
} from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import { useLanguage } from '@/components/LanguageProvider';
import { ROLES } from '@/utils/constants';

// Professional + firm-professional share the same dashboard modules.
const PROFESSIONAL_NAV = [
  {
    labelKey: 'dash.nav.overview',
    href: '/dashboard/professional',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'dash.nav.clients',
    href: '/dashboard/professional/clients',
    icon: Briefcase,
  },
  {
    labelKey: 'dash.nav.cases',
    href: '/dashboard/professional/cases',
    icon: FolderKanban,
  },
  {
    labelKey: 'dash.nav.bookings',
    href: '/dashboard/professional/bookings',
    icon: CalendarClock,
  },
  {
    labelKey: 'dash.nav.myReviews',
    href: '/dashboard/professional/reviews',
    icon: Star,
  },
  {
    labelKey: 'dash.nav.myFirm',
    href: '/dashboard/professional/firm',
    icon: Building2,
  },
  {
    labelKey: 'dash.nav.findProfessionals',
    href: '/professionals',
    icon: Search,
  },
  {
    labelKey: 'dash.nav.profile',
    href: '/profile/edit',
    icon: UserCircle,
  },
];

const NAV_BY_ROLE = {
  [ROLES.CLIENT]: [
    {
      labelKey: 'dash.nav.overview',
      href: '/dashboard/client',
      icon: LayoutDashboard,
    },
    {
      labelKey: 'dash.nav.myCases',
      href: '/dashboard/client/cases',
      icon: Briefcase,
    },
    {
      labelKey: 'dash.nav.myBookings',
      href: '/dashboard/client/bookings',
      icon: CalendarClock,
    },
    {
      labelKey: 'dash.nav.findProfessionals',
      href: '/professionals',
      icon: Search,
    },
    { labelKey: 'dash.nav.browseFirms', href: '/firms', icon: Building2 },
    {
      labelKey: 'dash.nav.profile',
      href: '/dashboard/client/profile',
      icon: UserCircle,
    },
  ],
  [ROLES.PROFESSIONAL]: PROFESSIONAL_NAV,
  [ROLES.FIRM_PROFESSIONAL]: PROFESSIONAL_NAV,
  [ROLES.FIRM_ADMIN]: [
    {
      labelKey: 'dash.nav.overview',
      href: '/dashboard/firm',
      icon: LayoutDashboard,
    },
    {
      labelKey: 'dash.nav.firmProfessionals',
      href: '/dashboard/firm/professionals',
      icon: Users,
    },
    {
      labelKey: 'dash.nav.joinRequests',
      href: '/dashboard/firm/join-requests',
      icon: UserPlus,
    },
    {
      labelKey: 'dash.nav.clients',
      href: '/dashboard/firm/clients',
      icon: Briefcase,
    },
    {
      labelKey: 'dash.nav.leads',
      href: '/dashboard/firm/leads',
      icon: Inbox,
    },
    {
      labelKey: 'dash.nav.cases',
      href: '/dashboard/firm/cases',
      icon: FolderKanban,
    },
    {
      labelKey: 'dash.nav.reviews',
      href: '/dashboard/firm/reviews',
      icon: Star,
    },
    {
      labelKey: 'dash.nav.firmProfile',
      href: '/dashboard/firm/profile',
      icon: Building2,
    },
  ],
  [ROLES.PLATFORM_ADMIN]: [
    {
      labelKey: 'dash.nav.overview',
      href: '/dashboard/admin',
      icon: LayoutDashboard,
    },
    {
      labelKey: 'dash.nav.professionalApprovals',
      href: '/admin/professionals',
      icon: ShieldCheck,
    },
    // Firms is a collapsible group — both the CRUD list and the approval
    // workflow live under it.
    {
      labelKey: 'dash.nav.firms',
      icon: Building2,
      children: [
        {
          labelKey: 'dash.nav.firms',
          href: '/admin/law-firms',
          icon: Building2,
        },
        {
          labelKey: 'dash.nav.firmApprovals',
          href: '/admin/firms',
          icon: ShieldCheck,
        },
      ],
    },
    { labelKey: 'dash.nav.users', href: '/admin/users', icon: Users },
    // Sales pipeline: Lead -> Opportunity -> Client. The two screens are
    // grouped so admin can flip between them quickly.
    {
      labelKey: 'dash.nav.pipeline',
      icon: TrendingUp,
      children: [
        {
          labelKey: 'dash.nav.leads',
          href: '/admin/leads',
          icon: Inbox,
        },
        {
          labelKey: 'dash.nav.opportunities',
          href: '/admin/opportunities',
          icon: TrendingUp,
        },
      ],
    },
    {
      labelKey: 'dash.nav.reviews',
      href: '/admin/reviews',
      icon: Star,
    },
    {
      labelKey: 'dash.nav.reviewAppeals',
      href: '/admin/review-appeals',
      icon: Flag,
    },
    {
      labelKey: 'dash.nav.auditLogs',
      href: '/admin/audit-logs',
      icon: ScrollText,
    },
    // App settings: admin-managed taxonomy + city list that drive every
    // dropdown across the platform.
    {
      labelKey: 'dash.nav.appSettings',
      icon: Settings,
      children: [
        {
          labelKey: 'dash.nav.categories',
          href: '/admin/categories',
          icon: ListTree,
        },
        {
          labelKey: 'dash.nav.cities',
          href: '/admin/locations',
          icon: MapPin,
        },
      ],
    },
  ],
};

/**
 * SidebarLink — leaf navigation item.
 */
function SidebarLink({ item, active }) {
  const { t } = useLanguage();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {Icon ? <Icon size={18} /> : null}
      {t(item.labelKey)}
    </Link>
  );
}

/**
 * SidebarGroup — collapsible nav item with nested children. Auto-opens when
 * any of its children matches the current pathname.
 */
function SidebarGroup({ item, isActive }) {
  const { t } = useLanguage();
  const childHrefs = (item.children || []).map((c) => c.href);
  const containsActive = childHrefs.some((href) => isActive(href));
  const [open, setOpen] = useState(containsActive);

  // Re-sync expanded state when navigating into a child route.
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  const Icon = item.icon;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          containsActive
            ? 'text-blue-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {Icon ? <Icon size={18} /> : null}
        <span className="flex-1 text-left">{t(item.labelKey)}</span>
        <ChevronRight
          size={16}
          className={`text-slate-400 transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-3">
          {item.children.map((child) => (
            <SidebarLink
              key={child.href}
              item={child}
              active={isActive(child.href)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sidebar — Pro Firmo logo + role-specific navigation. Items with a
 * `children` array render as collapsible groups.
 * Props: { role }
 */
export default function Sidebar({ role }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE[ROLES.CLIENT];

  function isActive(href) {
    return pathname === href;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <BrandLogo variant="light" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t('dash.nav.menu')}
        </p>
        {items.map((item) => {
          if (Array.isArray(item.children) && item.children.length > 0) {
            return (
              <SidebarGroup
                key={item.labelKey}
                item={item}
                isActive={isActive}
              />
            );
          }
          return (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
            />
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft size={18} />
          {t('dash.nav.backToSite')}
        </Link>
      </div>
    </div>
  );
}
