// Wallet service — wraps the pro-facing wallet endpoints.
//   GET /api/wallet/summary        balances + lifetime markup
//   GET /api/wallet/transactions   paginated ledger

import { apiGet, unwrap } from './api';

export async function getWalletSummary() {
  const res = await apiGet('/api/wallet/summary');
  const data = unwrap(res);
  return (data && (data.summary || data)) || null;
}

export async function listWalletTransactions({ page, limit } = {}) {
  const res = await apiGet('/api/wallet/transactions', {
    query: { page, limit },
  });
  const data = unwrap(res);
  return {
    items: (data && data.items) || [],
    meta: (data && data.meta) || {},
  };
}

// Back-compat aliases for any callers still using the old names.
export const getMyWallet = getWalletSummary;
export const listMyWalletTransactions = async () => {
  const { items } = await listWalletTransactions({ page: 1, limit: 30 });
  return items;
};
