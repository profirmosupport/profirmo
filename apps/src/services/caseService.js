import { apiGet, unwrap } from './api';

export async function listMyCases() {
  const res = await apiGet('/api/cases/mine');
  const data = unwrap(res);
  return (data && data.items) || data || [];
}

export async function getCase(id) {
  const res = await apiGet(`/api/cases/${id}`);
  return unwrap(res);
}
