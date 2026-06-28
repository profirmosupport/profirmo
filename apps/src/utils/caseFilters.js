// Shared case-filter helpers — mirror of frontend/components/cases/
// CasesFilterBar.js so the mobile cases list filters identically to
// the web table. Kept independent from any RN imports so the helpers
// can be reused in tests or other utilities.

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

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function emptyCaseFilter() {
  return { q: '', stage: '', priority: '' };
}

export function isCaseFilterActive(filter) {
  if (!filter) return false;
  return Boolean(
    (filter.q && filter.q.trim()) || filter.stage || filter.priority
  );
}

function digitsOnly(s) {
  return String(s || '').replace(/\D+/g, '');
}

function clientHaystack(c) {
  if (!c) return '';
  return [c.name, c.email, c.phone].filter(Boolean).join(' ').toLowerCase();
}

function clientPhoneTail(c) {
  if (!c || !c.phone) return '';
  const d = digitsOnly(c.phone);
  return d.slice(-10);
}

export function applyCaseFilters(items, filter) {
  if (!Array.isArray(items)) return [];
  if (!isCaseFilterActive(filter)) return items;
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
    const clientHay = [
      clientHaystack(c.client),
      ...(Array.isArray(c.clients) ? c.clients.map(clientHaystack) : []),
    ].join(' ');
    if (clientHay.includes(q)) return true;
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
