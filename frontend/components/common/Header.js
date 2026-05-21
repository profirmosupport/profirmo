'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Scale, Menu, X } from 'lucide-react';
import Button from '@/components/common/Button';
import { NAV_LINKS, SITE } from '@/utils/constants';

/**
 * Header — sticky site header with desktop nav and a mobile hamburger menu.
 */
export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Scale size={20} />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-800">
            {SITE.name}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Button href="/auth/login" variant="ghost" size="sm">
            Log in
          </Button>
          <Button href="/auth/register-client" variant="primary" size="sm">
            Sign up
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3">
              <Button
                href="/auth/login"
                variant="outline"
                size="sm"
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Button>
              <Button
                href="/auth/register-client"
                variant="primary"
                size="sm"
                onClick={() => setMobileOpen(false)}
              >
                Sign up
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
