'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ClientTable from '@/components/dashboard/ClientTable';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import caseService from '@/services/caseService';
import { ROLES } from '@/utils/constants';

export default function FirmClientsPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await caseService.getFirmCases();
      setCases(Array.isArray(data && data.items) ? data.items : []);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Derive the firm's client list from the unique `client` payloads on its
  // cases (case responses already carry `client: { id, name, phone, email }`).
  const clientMap = new Map();
  for (const c of cases) {
    if (c.client && c.client.id && !clientMap.has(c.client.id)) {
      clientMap.set(c.client.id, c.client);
    } else if (c.clientId && !clientMap.has(c.clientId)) {
      clientMap.set(c.clientId, { id: c.clientId, name: c.clientId });
    }
  }
  const firmClients = [...clientMap.values()];

  return (
    <DashboardLayout
      role={ROLES.FIRM_ADMIN}
      title="Clients"
      subtitle="Clients with cases at your firm"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Users size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading clients…'
                : `${firmClients.length} client${
                    firmClients.length === 1 ? '' : 's'
                  }`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        ) : firmClients.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="No clients yet"
            description="Clients appear here once your firm has cases assigned to them."
          />
        ) : (
          <ClientTable clients={firmClients} />
        )}
      </div>
    </DashboardLayout>
  );
}
