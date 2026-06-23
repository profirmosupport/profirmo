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
  Wallet,
  ArrowDownToLine,
  CreditCard,
  Newspaper,
  Hash,
  Mail,
  Receipt,
  ChevronsLeft,
  ChevronsRight,
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
    // Inline label — i18n entry can be added later. Surfaces upcoming
    // GST / TDS / ITR / ROC filings across all clients.
    label: 'Compliance',
    href: '/dashboard/professional/compliance',
    icon: Receipt,
  },
  {
    labelKey: 'dash.nav.myReviews',
    href: '/dashboard/professional/reviews',
    icon: Star,
  },
  // Wallet / Payments / Payouts share a single collapsible parent so the
  // sidebar doesn't grow three entries deep for each money-related view.
  {
    labelKey: 'dash.nav.walletGroup',
    icon: Wallet,
    children: [
      {
        labelKey: 'dash.nav.wallet',
        href: '/dashboard/professional/wallet',
        icon: Wallet,
      },
      {
        labelKey: 'dash.nav.payments',
        href: '/dashboard/professional/payments',
        icon: CreditCard,
      },
      {
        labelKey: 'dash.nav.payouts',
        href: '/dashboard/professional/payouts',
        icon: ArrowDownToLine,
      },
    ],
  },
  {
    labelKey: 'dash.nav.myFirm',
    href: '/dashboard/professional/firm',
    icon: Building2,
  },
  {
    labelKey: 'dash.nav.subscription',
    href: '/dashboard/professional/subscription',
    icon: CreditCard,
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
      labelKey: 'dash.nav.payments',
      href: '/dashboard/client/payments',
      icon: CreditCard,
    },
    {
      // Inline label; i18n entry can be added later.
      label: 'Compliance',
      href: '/dashboard/client/compliance',
      icon: Receipt,
    },
    {
      // Combined search across professionals + firms — points at the
      // unified /search page. Replaces the older separate "Find
      // professionals" and "Browse firms" entries.
      label: 'Professionals & firms',
      href: '/search',
      icon: Search,
    },
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
  // ---------------------------------------------------------------------
  // Platform admin sidebar — grouped by functional area so the 20+ admin
  // surfaces don't sprawl as a flat list. Each top-level entry except the
  // Overview link is a collapsible group; SidebarGroup auto-opens when
  // any of its children matches the current path, so deep links still
  // surface the right section.
  // ---------------------------------------------------------------------
  [ROLES.PLATFORM_ADMIN]: [
    {
      labelKey: 'dash.nav.overview',
      href: '/dashboard/admin',
      icon: LayoutDashboard,
    },
    // Everything that touches an account record — users, professional-
    // approval queue, firm CRUD + firm-approval queue.
    {
      labelKey: 'dash.nav.userManagement',
      icon: Users,
      children: [
        {
          labelKey: 'dash.nav.professionalApprovals',
          href: '/admin/professionals',
          icon: ShieldCheck,
        },
        { labelKey: 'dash.nav.users', href: '/admin/users', icon: Users },
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
    // Sales + audience pipeline: Lead -> Opportunity -> Client, plus
    // Support tickets (contact-page submissions) and Newsletter
    // subscribers (footer + popup signups). All grouped here because
    // they're inbound funnels admin triages day to day.
    {
      labelKey: 'dash.nav.pipeline',
      icon: TrendingUp,
      children: [
        { labelKey: 'dash.nav.leads', href: '/admin/leads', icon: Inbox },
        {
          labelKey: 'dash.nav.opportunities',
          href: '/admin/opportunities',
          icon: TrendingUp,
        },
        {
          labelKey: 'dash.nav.support',
          href: '/admin/support',
          icon: Mail,
        },
        {
          labelKey: 'dash.nav.newsletter',
          href: '/admin/newsletter',
          icon: Mail,
        },
      ],
    },
    // Reviews + appeals — quality-control surfaces.
    {
      labelKey: 'dash.nav.reviewManagement',
      icon: Star,
      children: [
        { labelKey: 'dash.nav.reviews', href: '/admin/reviews', icon: Star },
        {
          labelKey: 'dash.nav.reviewAppeals',
          href: '/admin/review-appeals',
          icon: Flag,
        },
      ],
    },
    // Money flows — Razorpay reconciliation, the payout queue and the
    // subscription tier registry.
    {
      labelKey: 'dash.nav.finance',
      icon: Wallet,
      children: [
        {
          labelKey: 'dash.nav.payments',
          href: '/admin/payments',
          icon: CreditCard,
        },
        {
          labelKey: 'dash.nav.payouts',
          href: '/admin/payouts',
          icon: ArrowDownToLine,
        },
        {
          labelKey: 'dash.nav.subscriptions',
          href: '/admin/subscriptions',
          icon: CreditCard,
        },
      ],
    },
    // Employee module — field agents who onboard professionals via
    // /join-team. Listing + payout queue + commission/payout settings.
    {
      label: 'Employees',
      icon: UserPlus,
      children: [
        { label: 'Employee listing', href: '/admin/employees', icon: Users },
        {
          label: 'Payout requests',
          href: '/admin/employee-payouts',
          icon: ArrowDownToLine,
        },
        {
          label: 'Module settings',
          href: '/admin/employee-settings',
          icon: Settings,
        },
      ],
    },
    // Blog / journal — admin-managed. The three children mirror the
    // backend's posts / categories / tags split.
    {
      labelKey: 'dash.nav.content',
      icon: Newspaper,
      children: [
        {
          labelKey: 'dash.nav.blogPosts',
          href: '/admin/blog',
          icon: Newspaper,
        },
        {
          labelKey: 'dash.nav.blogCategories',
          href: '/admin/blog/categories',
          icon: ListTree,
        },
        {
          labelKey: 'dash.nav.blogTags',
          href: '/admin/blog/tags',
          icon: Hash,
        },
      ],
    },
    // System: audit logs + the admin-managed taxonomy/city list that
    // drives every dropdown across the platform.
    {
      labelKey: 'dash.nav.system',
      icon: Settings,
      children: [
        {
          labelKey: 'dash.nav.auditLogs',
          href: '/admin/audit-logs',
          icon: ScrollText,
        },
        {
          labelKey: 'dash.nav.platformSettings',
          href: '/admin/settings',
          icon: Settings,
        },
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
        {
          labelKey: 'dash.nav.caseStatuses',
          href: '/admin/case-statuses',
          icon: ListTree,
        },
        {
          labelKey: 'dash.nav.caseTypes',
          href: '/admin/case-types',
          icon: ListTree,
        },
        {
          labelKey: 'dash.nav.causeListTypes',
          href: '/admin/cause-list-types',
          icon: ListTree,
        },
      ],
    },
  ],
};

/**
 * SidebarLink — leaf navigation item. In `collapsed` mode the icon
 * sits centred with the label hidden (browser-native tooltip via
 * `title=` carries the affordance).
 */
function SidebarLink({ item, active, collapsed }) {
  const { t } = useLanguage();
  const Icon = item.icon;
  const label = item.labelKey ? t(item.labelKey) : item.label;
  return (
    <Link
      href={item.href}
      title={collapsed ? label : undefined}
      className={[
        'flex items-center rounded-lg text-sm font-medium transition-colors',
        collapsed
          ? 'justify-center px-2 py-2.5'
          : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      ].join(' ')}
    >
      {Icon ? <Icon size={18} /> : null}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

/**
 * SidebarGroup — collapsible nav item with nested children. In
 * `collapsed` (sidebar) mode the group renders as a single icon row
 * and clicking it doesn't try to expand — children are surfaced via
 * the per-icon link in a popout only after the sidebar is expanded.
 * Auto-opens when any of its children matches the current pathname.
 */
function SidebarGroup({ item, isActive, collapsed }) {
  const { t } = useLanguage();
  const childHrefs = (item.children || []).map((c) => c.href);
  const containsActive = childHrefs.some((href) => isActive(href));
  const [open, setOpen] = useState(containsActive);

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  const Icon = item.icon;
  const label = item.labelKey ? t(item.labelKey) : item.label;

  if (collapsed) {
    // Render a compact icon row that links to the FIRST child as a
    // sensible single-target for the collapsed surface.
    const firstChild = (item.children || [])[0];
    if (!firstChild) return null;
    return (
      <Link
        href={firstChild.href}
        title={label}
        className={[
          'flex items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium transition-colors',
          containsActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        ].join(' ')}
      >
        {Icon ? <Icon size={18} /> : null}
      </Link>
    );
  }

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
        <span className="flex-1 text-left">{label}</span>
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
 * `children` array render as collapsible groups. When `collapsed` is
 * true the sidebar narrows to an icon-only rail; clicking the toggle
 * at the bottom expands/collapses it. `onToggleCollapsed` is the
 * controlled callback — the parent (DashboardLayout) owns the state
 * and persists it via UserPreference.
 *
 * Props: { role, collapsed?, onToggleCollapsed? }
 */
export default function Sidebar({ role, collapsed = false, onToggleCollapsed }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const baseItems = NAV_BY_ROLE[role] || NAV_BY_ROLE[ROLES.CLIENT];
  const items = baseItems;

  function isActive(href) {
    return pathname === href;
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex items-center border-b border-slate-200 py-4 ${
          collapsed ? 'justify-center px-2' : 'gap-2 px-5'
        }`}
      >
        {collapsed ? (
          <Link href="/" title="Pro Firmo home" className="inline-flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/profirmo-logo.png"
              alt="Pro Firmo"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
          </Link>
        ) : (
          <BrandLogo variant="light" />
        )}
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* Firm-admin users sit on a separate dashboard — give them a
            one-tap return to their personal/professional dashboard so
            they don't have to navigate via the global site root. */}
        {role === ROLES.FIRM_ADMIN && (
          <Link
            href="/dashboard/professional"
            title={collapsed ? 'Personal dashboard' : undefined}
            className={[
              'mb-3 flex items-center rounded-lg border border-amber-200 bg-amber-50/70 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2',
            ].join(' ')}
          >
            <ArrowLeft size={15} />
            {!collapsed && <span>Personal dashboard</span>}
          </Link>
        )}
        {!collapsed && (
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('dash.nav.menu')}
          </p>
        )}
        {items.map((item) => {
          if (Array.isArray(item.children) && item.children.length > 0) {
            return (
              <SidebarGroup
                key={item.labelKey || item.label}
                item={item}
                isActive={isActive}
                collapsed={collapsed}
              />
            );
          }
          return (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      <div className={`border-t border-slate-200 py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'mb-1 flex w-full items-center rounded-lg text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
            ].join(' ')}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
        <Link
          href="/"
          title={collapsed ? t('dash.nav.backToSite') : undefined}
          className={[
            'flex items-center rounded-lg text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900',
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
          ].join(' ')}
        >
          <ArrowLeft size={18} />
          {!collapsed && <span>{t('dash.nav.backToSite')}</span>}
        </Link>
      </div>
    </div>
  );
}
