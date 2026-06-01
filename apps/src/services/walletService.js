import { apiGet, unwrap } from './api';

export async function getMyWallet() {
  const res = await apiGet('/api/wallet/mine');
  return unwrap(res);
}

export async function listMyWalletTransactions() {
  const res = await apiGet('/api/wallet/transactions');
  const data = unwrap(res);
  return (data && data.items) || [];
}
