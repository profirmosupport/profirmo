'use client';

// CasesFilterBar — shared search + filter row mounted above the case
// table / Kanban on both the firm and per-pro cases pages.
//
// Filters are purely client-side: the cases list isn't large enough on
// either dashboard to justify a server-side search round-trip. We
// expose a small `applyCaseFilters(items, filter)` helper alongside
// the component so both pages can derive `filteredItems` identically.
//
// Filter shape (also returned from emptyFilter()):
//   {
//     q:        string  — free-text. Matches title, caseNumber, cnr,
//                          courtName, opposingParty, description AND
//                          every linked client's name / phone / email.
//     stage:    string  — '' for any, otherwise a STAGE_ORDER key.
//                          Special value '__unassigned' picks rows
//                          with no stage set.
//     priority: string  — '' for any, otherwise low/medium/high/urgent.
//   }

import { Search, X } from 'lucide-react';

export const STAGE_ORDER = [
  'intake',
  'preparation',
  'filed',
  'awaiting_response',
  'hearing',
  'closing',
  'closed',
];

export const STAGE_LABEL = {
  intake: 'Intake',
  preparation: 'Preparation',
  filed: 'Filed',
  awaiting_response: 'Awaiting Response',
  hearing: 'Hearing',
  closing: 'Closing',
  closed: 'Closed',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function emptyFilter() {
  return { q: '', stage: '', priority: '' };
}

export function isFilterActive(filter) {
  if (!filter) return false;
  return Boolean(
    (filter.q && filter.q.trim()) || filter.stage || filter.priority
  );
}

// Normalise a phone number to its last 10 digits so a user can search
// "9310819195" and match a stored value of "+91 9310819195".
function digitsOnly(s) {
  return String(s || '').replace(/\D+/g, '');
}

function clientHaystack(c) {
  // c can be either the decorated `client` shape (single) or an entry
  // from `clients` (array). Pull every field a user might search on.
  if (!c) return '';
  return [c.name, c.email, c.phone].filter(Boolean).join(' ').toLowerCase();
}

function clientPhoneTail(c) {
  if (!c || !c.phone) return '';
  const d = digitsOnly(c.phone);
  return d.slice(-10);
}

/**
 * applyCaseFilters — pure helper used by the cases pages to derive
 * the visible subset. Returning a new array is fine; the lists never
 * cross a few hundred rows.
 */
export function applyCaseFilters(items, filter) {
  if (!Array.isArray(items)) return [];
  if (!isFilterActive(filter)) return items;
  const q = (filter.q || '').trim().toLowerCase();
  const qDigits = digitsOnly(filter.q);
  return items.filter((c) => {
    if (filter.stage) {
      if (filter.stage === '__unassigned') {
        if (c.stage) return false;
      } else if (c.stage !== filter.stage) {
        return false;
      }
    }
    if (filter.priority && c.priority !== filter.priority) {
      return false;
    }
    if (!q) return true;
    // Text fields on the case itself.
    const caseHay = [
      c.title,
      c.caseNumber,
      c.cnr,
      c.courtName,
      c.opposingParty,
      c.category,
      c.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (caseHay.includes(q)) return true;
    // Linked client(s). The list page hands us `client` (primary) and
    // sometimes `clients[]` (full list). Hit both for parity.
    const clientHay = [
      clientHaystack(c.client),
      ...(Array.isArray(c.clients) ? c.clients.map(clientHaystack) : []),
    ].join(' ');
    if (clientHay.includes(q)) return true;
    // Phone lookup — match against the last-10-digit form so format
    // differences ("+91 ...", "0 ...", spaces) don't break the search.
    if (qDigits.length >= 4) {
      const phones = [
        clientPhoneTail(c.client),
        ...(Array.isArray(c.clients) ? c.clients.map(clientPhoneTail) : []),
      ].filter(Boolean);
      if (phones.some((p) => p.includes(qDigits))) return true;
    }
    return false;
  });
}

export default function CasesFilterBar({
  value,
  onChange,
  totalCount,
  matchCount,
}) {
  const filter = value || emptyFilter();
  function patch(part) {
    onChange({ ...filter, ...part });
  }
  const active = isFilterActive(filter);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={filter.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Search by title, client name, phone, CNR or court…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Search cases"
          />
          {filter.q ? (
            <button
              type="button"
              onClick={() => patch({ q: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <select
          value={filter.stage}
          onChange={(e) => patch({ stage: e.target.value })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          <option value="__unassigned">— Not set —</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          value={filter.priority}
          onChange={(e) => patch({ priority: e.target.value })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {active ? (
          <button
            type="button"
            onClick={() => onChange(emptyFilter())}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
          >
            <X size={12} />
            Clear filters
          </button>
        ) : null}
      </div>

      {active && typeof totalCount === 'number' ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Showing{' '}
          <span className="font-semibold text-slate-700">{matchCount}</span> of{' '}
          {totalCount} case{totalCount === 1 ? '' : 's'} matching your filters.
        </p>
      ) : null}
    </div>
  );
}
