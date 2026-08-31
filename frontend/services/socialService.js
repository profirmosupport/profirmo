// Admin-only helpers for the daily Instagram + YouTube news carousel module,
// wrapping /api/admin/social/*.

import { get, post, del } from '@/services/api';

function unwrap(res) {
  if (res && Object.prototype.hasOwnProperty.call(res, 'data')) return res.data;
  return res;
}

// GET /api/admin/social/status → { bufferConfigured, autoPost, perDay }
export async function getSocialStatus() {
  const res = await get('/api/admin/social/status');
  return unwrap(res) || { bufferConfigured: false, autoPost: false, perDay: 3 };
}

// GET /api/admin/social/posts?page=&limit=&status=
export async function listSocialPosts(params = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await get(`/api/admin/social/posts${suffix}`);
  // Paginated shape: { data: [...], meta: {...} }
  return {
    items: (res && res.data) || [],
    meta: (res && res.meta) || { page: 1, limit: 20, total: 0 },
  };
}

// GET /api/admin/social/posts/:id
export async function getSocialPost(id) {
  const res = await get(`/api/admin/social/posts/${id}`);
  return unwrap(res);
}

// POST /api/admin/social/posts/generate  { autoPost? }
export async function generateSocialPost(autoPost = false) {
  const res = await post('/api/admin/social/posts/generate', { autoPost: !!autoPost });
  return unwrap(res);
}

// POST /api/admin/social/posts/:id/post — approve + push to Buffer.
export async function postSocialPost(id) {
  const res = await post(`/api/admin/social/posts/${id}/post`, {});
  return unwrap(res);
}

// DELETE /api/admin/social/posts/:id
export async function deleteSocialPost(id) {
  const res = await del(`/api/admin/social/posts/${id}`);
  return unwrap(res);
}
