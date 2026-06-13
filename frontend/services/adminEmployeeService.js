// Admin-side client for the Employee module. Wraps /api/admin/*
// using the shared api helpers so the auth header + refresh flow
// the rest of the admin UI relies on apply here too.

import { get, post, patch, del, apiRequest } from '@/services/api';

function unwrap(res) {
  return res && Object.prototype.hasOwnProperty.call(res, 'data')
    ? res.data
    : res;
}

// --- Listing + detail --------------------------------------------------
export async function listEmployees({ q = '', status = '' } = {}) {
  const res = await get('/api/admin/employees', { params: { q, status } });
  return unwrap(res) || [];
}

export async function getEmployee(id) {
  const res = await get(`/api/admin/employees/${id}`);
  return unwrap(res);
}

export async function getEmployeeProfessionals(id) {
  const res = await get(`/api/admin/employees/${id}/professionals`);
  return unwrap(res) || [];
}

export async function createEmployee(payload) {
  const res = await post('/api/admin/employees', payload);
  return unwrap(res);
}

export async function updateEmployee(id, payload) {
  const res = await patch(`/api/admin/employees/${id}`, payload);
  return unwrap(res);
}

export async function deleteEmployee(id) {
  const res = await del(`/api/admin/employees/${id}`);
  return unwrap(res);
}

// --- Payouts ----------------------------------------------------------
export async function listAllPayouts({ status = '' } = {}) {
  const res = await get('/api/admin/employee-payouts', { params: { status } });
  return unwrap(res) || [];
}

export async function decidePayout(id, body) {
  const res = await patch(`/api/admin/employee-payouts/${id}`, body);
  return unwrap(res);
}

// --- Settings ---------------------------------------------------------
export async function getSettings() {
  const res = await get('/api/admin/employee-settings');
  return unwrap(res);
}

export async function saveSettings(body) {
  const res = await apiRequest('/api/admin/employee-settings', {
    method: 'PUT',
    body,
  });
  return unwrap(res);
}
