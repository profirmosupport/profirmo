'use client';

import { Users } from 'lucide-react';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
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
 * ClientTable — responsive table of clients.
 * Props: { clients }
 */
export default function ClientTable({ clients }) {
  const list = clients || [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="No clients yet"
        description="Clients you consult with will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Type</th>
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
                    {c.userType === 'business' ? 'Business' : 'Individual'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
