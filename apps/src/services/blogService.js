import { apiGet, unwrap } from './api';

// Blog endpoints — public, no auth required.

export async function listBlogPosts({ limit, page, search, category } = {}) {
  const res = await apiGet('/api/blog/posts', {
    query: { limit, page, search, category },
  });
  const data = unwrap(res);
  return Array.isArray(data) ? data : (data && data.items) || [];
}

export async function getBlogPost(slug) {
  const res = await apiGet(`/api/blog/posts/${slug}`);
  const data = unwrap(res);
  return (data && data.post) || data;
}

export async function listBlogCategories() {
  const res = await apiGet('/api/blog/categories');
  const data = unwrap(res);
  return Array.isArray(data) ? data : (data && data.items) || [];
}
