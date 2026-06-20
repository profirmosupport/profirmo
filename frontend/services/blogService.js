// blogService — wrappers for /api/blog (public) and /api/admin/blog/*
// (admin CRUD + image upload).
//
// The public listing + detail pages can be statically generated when needed
// — wherever possible we use plain `fetch` rather than the authed `api`
// helper so SSR works against the public endpoints without a token.

import { get, post, patch, del, getApiBaseUrl, getAccessToken } from '@/services/api';

function unwrap(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data')) {
    return response.data;
  }
  return response;
}

// --- Public reads (used by /blog pages) ----------------------------------

export async function listPosts(params = {}) {
  const res = await get('/api/blog/posts', { params });
  return {
    items: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

export async function getPost(slug) {
  const res = await get(`/api/blog/posts/${encodeURIComponent(slug)}`);
  return unwrap(res);
}

export async function listCategories() {
  const res = await get('/api/blog/categories');
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function listTags() {
  const res = await get('/api/blog/tags');
  const data = unwrap(res);
  return (data && data.items) || [];
}

/**
 * Server-side fetch (called from Next's `generateMetadata` / RSC).
 *
 * The browser version of getApiBaseUrl picks the prod backend by sniffing
 * `window.location.hostname` — that branch is unreachable on the server,
 * so we layer the lookup explicitly:
 *   1. NEXT_PUBLIC_API_URL (build-time bake)
 *   2. API_BASE_URL (server-only env, useful for previews)
 *   3. In production: the known prod backend host
 *   4. Otherwise: localhost dev backend
 *
 * Any fetch failure (DNS, ECONNREFUSED, timeout, non-2xx) returns null so
 * the Server Component renders the 404 page instead of throwing — which is
 * what produced the `Application error` digest in production.
 */
function ssrApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (process.env.NODE_ENV === 'production') {
    // EC2 + nginx + LE at proapi.profirmo.com
    // (was profirmo.onrender.com until 2026-06-20).
    return 'https://proapi.profirmo.com';
  }
  return 'http://localhost:5000';
}

export async function ssrGetPost(slug) {
  const base = ssrApiBase();
  try {
    const res = await fetch(
      `${base}/api/blog/posts/${encodeURIComponent(slug)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body || !body.success) return null;
    return body.data;
  } catch (err) {
    console.error('[ssrGetPost] fetch failed for', slug, '-', err.message);
    return null;
  }
}

// --- Admin CRUD ----------------------------------------------------------

export async function adminListPosts(params = {}) {
  const res = await get('/api/admin/blog/posts', { params });
  return {
    items: (res && res.data) || [],
    meta: (res && res.meta) || null,
  };
}

export async function adminGetPost(id) {
  const res = await get(`/api/admin/blog/posts/${id}`);
  return unwrap(res);
}

export async function adminCreatePost(body) {
  const res = await post('/api/admin/blog/posts', body);
  return unwrap(res);
}

export async function adminUpdatePost(id, body) {
  const res = await patch(`/api/admin/blog/posts/${id}`, body);
  return unwrap(res);
}

export async function adminDeletePost(id) {
  const res = await del(`/api/admin/blog/posts/${id}`);
  return unwrap(res);
}

export async function adminListCategories() {
  const res = await get('/api/admin/blog/categories');
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function adminCreateCategory(body) {
  const res = await post('/api/admin/blog/categories', body);
  return unwrap(res);
}

export async function adminUpdateCategory(id, body) {
  const res = await patch(`/api/admin/blog/categories/${id}`, body);
  return unwrap(res);
}

export async function adminDeleteCategory(id) {
  const res = await del(`/api/admin/blog/categories/${id}`);
  return unwrap(res);
}

export async function adminListTags() {
  const res = await get('/api/admin/blog/tags');
  const data = unwrap(res);
  return (data && data.items) || [];
}

export async function adminCreateTag(body) {
  const res = await post('/api/admin/blog/tags', body);
  return unwrap(res);
}

export async function adminUpdateTag(id, body) {
  const res = await patch(`/api/admin/blog/tags/${id}`, body);
  return unwrap(res);
}

export async function adminDeleteTag(id) {
  const res = await del(`/api/admin/blog/tags/${id}`);
  return unwrap(res);
}

/**
 * Upload a featured image to the backend, which writes it to the frontend's
 * public/blog-images folder. Returns `{ url, fileName, size, mimeType }`.
 * The URL is rooted at the frontend (no /api prefix) so <img> tags can
 * reference it directly.
 */
export async function adminUploadImage(file) {
  if (!file) throw new Error('No file selected.');
  const formData = new FormData();
  formData.append('file', file);
  const token = getAccessToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(
    `${getApiBaseUrl()}/api/admin/blog/images`,
    {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    }
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || !body.success) {
    const message = (body && body.message) || 'Image upload failed.';
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return body.data;
}
