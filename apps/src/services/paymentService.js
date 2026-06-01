import { apiGet, unwrap } from './api';

export async function listMyPayments(side = 'any') {
  const res = await apiGet('/api/payments/mine', { query: { side } });
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function getPayment(id) {
  const res = await apiGet(`/api/payments/${id}`);
  return unwrap(res);
}
