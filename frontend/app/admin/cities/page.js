'use client';

// The Cities page is consolidated under /admin/locations now (Country →
// State → City tree). Redirect to the new page so existing bookmarks +
// the sidebar link keep working.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminCitiesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/locations');
  }, [router]);
  return null;
}
