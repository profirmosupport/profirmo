'use client';

import { useState } from 'react';
import { Users, Receipt } from 'lucide-react';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import ClientComplianceModal from '@/components/dashboard/ClientComplianceModal';
import { useLanguage } from '@/components/LanguageProvider';
import { getInitials } from '@/utils/formatters';

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-cyan-600',
];

function colorFor(id) {
  const str = String(id || '');
  let sum = 0;
  for (let i = 0; i < str.length; i += 1) sum += str.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

/**
 * ClientTable — responsive table of clients. Each row now exposes a
 * Compliance action that opens the per-client compliance profile
 * editor (entity type, GSTIN, scheme + flags) plus a one-click
 * generator that materialises the upcoming filing schedule.
 *
 * Props: { clients }
 */
export default function ClientTable({ clients }) {
  const { t } = useLanguage();
  const list = clients || [];
  const [compliance, setCompliance] = useState(null);

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title={t('dash.clientTable.emptyTitle')}
        description={t('dash.clientTable.emptyDesc')}
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">{t('dash.table.client')}</th>
                <th className="px-4 py-3">{t('dash.table.email')}</th>
                <th className="px-4 py-3">{t('dash.table.phone')}</th>
                <th className="px-4 py-3">{t('dash.table.city')}</th>
                <th className="px-4 py-3">{t('dash.table.type')}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${colorFor(
                          c.id
                        )}`}
                      >
                        {getInitials(c.name)}
                      </span>
                      <span className="font-medium text-slate-800">
                        {c.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.city || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.userType === 'business' ? 'blue' : 'gray'}>
                      {c.userType === 'business'
                        ? t('dash.table.business')
                        : t('dash.table.individual')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setCompliance({ id: c.id, name: c.name })
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                      title="Set up tax / legal compliance schedule"
                    >
                      <Receipt size={12} />
                      Compliance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ClientComplianceModal
        open={!!compliance}
        onClose={() => setCompliance(null)}
        clientUserId={compliance ? compliance.id : null}
        clientName={compliance ? compliance.name : null}
      />
    </>
  );
}
