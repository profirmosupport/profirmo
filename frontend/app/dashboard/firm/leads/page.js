'use client';

// Firm dashboard — leads pipeline.
// Lists every inquiry submitted via the public firm-profile "Contact firm"
// modal. The endpoint is auth-gated server-side (only the firm owner sees
// their own inquiries) and resolves the firm by req.user.

import { useCallback, useEffect, useState } from 'react';
import {
  Inbox,
  RefreshCw,
  AlertTriangle,
  Mail,
  Phone,
  MessageSquare,
  UserPlus,
  CheckCircle2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import { listMyFirmLeads, addLeadAsClient } from '@/services/leadService';
import { formatDate } from '@/utils/formatters';
import { ROLES } from '@/utils/constants';

function statusVariant(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'converted') return 'green';
  if (s === 'qualified' || s === 'opportunity') return 'blue';
  if (s === 'contacted') return 'amber';
  return 'gray';
}

export default function FirmLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Per-row "Adding…" + error state, keyed by lead.id.
  const [addingId, setAddingId] = useState('');
  const [rowError, setRowError] = useState({});
  // Banner shown after a successful conversion ("Added Smita as a client").
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listMyFirmLeads();
      setLeads(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load firm leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddAsClient(lead) {
    if (addingId) return;
    setAddingId(lead.id);
    setRowError((m) => ({ ...m, [lead.id]: undefined }));
    setNotice('');
    try {
      const result = await addLeadAsClient(lead.id);
      const name =
        (result && result.client && result.client.name) || lead.fullName;
      setNotice(`Added ${name} as a client.`);
      await load();
    } catch (err) {
      setRowError((m) => ({
        ...m,
        [lead.id]: err.message || 'Could not add this lead as a client.',
      }));
    } finally {
      setAddingId('');
    }
  }

  return (
    <DashboardLayout
      role={ROLES.FIRM_ADMIN}
      title="Leads"
      subtitle="Inquiries submitted from your firm's public profile"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Inbox size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading leads…'
                : `${leads.length} inquir${leads.length === 1 ? 'y' : 'ies'}`}
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
                className="h-24 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </span>
              <p className="text-sm font-medium text-slate-700">{error}</p>
              <Button size="sm" onClick={load}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          </Card>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<Inbox size={24} />}
            title="No inquiries yet"
            description="When someone uses the Contact firm button on your public profile, their inquiry will appear here."
          />
        ) : (
          <div className="space-y-3">
            {notice && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span className="flex-1">{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice('')}
                  className="text-xs font-medium text-emerald-700 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            {leads.map((lead) => {
              const isConverted =
                String(lead.status || '').toLowerCase() === 'converted';
              return (
                <Card key={lead.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {lead.fullName}
                        </p>
                        <Badge variant={statusVariant(lead.status)}>
                          {lead.status || 'New'}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {formatDate(lead.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                        <a
                          href={`mailto:${lead.email}`}
                          className="inline-flex items-center gap-1.5 hover:text-teal-700"
                        >
                          <Mail size={13} className="text-slate-400" />
                          {lead.email}
                        </a>
                        <a
                          href={`tel:${lead.phone}`}
                          className="inline-flex items-center gap-1.5 hover:text-teal-700"
                        >
                          <Phone size={13} className="text-slate-400" />
                          {lead.phone}
                        </a>
                      </div>
                      {lead.message && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <MessageSquare
                            size={14}
                            className="mt-0.5 shrink-0 text-slate-400"
                          />
                          <p className="whitespace-pre-line">{lead.message}</p>
                        </div>
                      )}
                      {rowError[lead.id] && (
                        <p className="mt-2 text-xs text-red-600">
                          {rowError[lead.id]}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {isConverted ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <CheckCircle2 size={13} />
                          Added as client
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleAddAsClient(lead)}
                          disabled={addingId === lead.id || Boolean(addingId)}
                        >
                          <UserPlus size={14} />
                          {addingId === lead.id
                            ? 'Adding…'
                            : 'Add as client'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
