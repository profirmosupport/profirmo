'use client';

// BlogPostForm — shared by /admin/blog/posts/new and /[id]/edit. Combines:
//   - Title + slug + excerpt
//   - HTML content textarea (admin types raw markup; this is an internal tool)
//   - Featured-image upload (writes to frontend/public/blog-images server-side)
//   - Category dropdown + multi-tag picker (both fed by admin endpoints)
//   - SEO + OG fieldset collapsed at the bottom

import { useEffect, useState } from 'react';
import {
  Save,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import Card from '@/components/common/Card';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import {
  adminListCategories,
  adminListTags,
  adminUploadImage,
  adminCreatePost,
  adminUpdatePost,
  adminRegenerateBlogImage,
} from '@/services/blogService';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft (not visible)' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

function buildInitial(post) {
  return {
    title: (post && post.title) || '',
    slug: (post && post.slug) || '',
    excerpt: (post && post.excerpt) || '',
    content: (post && post.content) || '',
    featuredImage: (post && post.featuredImage) || '',
    categoryId: (post && post.categoryId) || '',
    tagIds: Array.isArray(post && post.tagIds) ? post.tagIds : [],
    status: (post && post.status) || 'draft',
    seoTitle: (post && post.seoTitle) || '',
    seoDescription: (post && post.seoDescription) || '',
    ogTitle: (post && post.ogTitle) || '',
    ogDescription: (post && post.ogDescription) || '',
    ogImage: (post && post.ogImage) || '',
  };
}

export default function BlogPostForm({ post, onSaved }) {
  const isEdit = Boolean(post && post.id);
  const [form, setForm] = useState(() => buildInitial(post));
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Gemini "Generate image" — only available on edit (need a post id).
  const [aiImageBusy, setAiImageBusy] = useState(false);
  async function runAiImage() {
    if (!isEdit || !post || !post.id || aiImageBusy) return;
    setAiImageBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await adminRegenerateBlogImage(post.id);
      if (res && res.url) {
        update('featuredImage', res.url);
        setNotice(
          'Featured image generated via ' + (res.source || 'AI') + '.'
        );
      } else {
        setError('AI returned no image URL.');
      }
    } catch (err) {
      setError(err?.message || 'AI image generation failed.');
    } finally {
      setAiImageBusy(false);
    }
  }

  useEffect(() => {
    setForm(buildInitial(post));
  }, [post]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cats, tg] = await Promise.all([
          adminListCategories(),
          adminListTags(),
        ]);
        if (active) {
          setCategories(cats);
          setTags(tg);
        }
      } catch {
        /* ignore — selectors stay empty if the lookup fails */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleTag(id) {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id)
        ? f.tagIds.filter((t) => t !== id)
        : [...f.tagIds, id],
    }));
  }

  async function handleImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const result = await adminUploadImage(file);
      update('featuredImage', result.url);
      setNotice('Image uploaded to public/blog-images/');
    } catch (err) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (saving) return;
    setError('');
    setNotice('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.content.trim()) {
      setError('Content is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim() || null,
        content: form.content,
        featuredImage: form.featuredImage || null,
        categoryId: form.categoryId || null,
        tagIds: form.tagIds,
        status: form.status,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        ogTitle: form.ogTitle.trim() || null,
        ogDescription: form.ogDescription.trim() || null,
        ogImage: form.ogImage.trim() || null,
      };
      const saved = isEdit
        ? await adminUpdatePost(post.id, payload)
        : await adminCreatePost(payload);
      setNotice(isEdit ? 'Post saved.' : 'Post created.');
      if (typeof onSaved === 'function') onSaved(saved);
    } catch (err) {
      setError(err.message || 'Failed to save the post.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-xs font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Content */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-900">
              Content
            </h3>
            <div className="mt-4 space-y-3">
              <Input
                label="Title"
                name="title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                required
              />
              <Input
                label="Slug (auto from title if empty)"
                name="slug"
                value={form.slug}
                onChange={(e) => update('slug', e.target.value)}
                placeholder="e.g. how-to-file-itr"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Excerpt (used in cards + meta description fallback)
                </label>
                <textarea
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => update('excerpt', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Body (HTML)
                </label>
                <p className="mb-2 text-xs text-slate-500">
                  Paste rich HTML —{' '}
                  <code className="rounded bg-slate-100 px-1">&lt;h2&gt;</code>,{' '}
                  <code className="rounded bg-slate-100 px-1">&lt;p&gt;</code>,{' '}
                  <code className="rounded bg-slate-100 px-1">&lt;ul&gt;</code>,{' '}
                  <code className="rounded bg-slate-100 px-1">&lt;img&gt;</code>,{' '}
                  <code className="rounded bg-slate-100 px-1">&lt;blockquote&gt;</code>
                  {' '}etc. The detail page renders this verbatim with editorial typography.
                </p>
                <textarea
                  rows={20}
                  value={form.content}
                  onChange={(e) => update('content', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  placeholder="<p>Hello world…</p>"
                />
              </div>
            </div>
          </Card>

          {/* SEO + OG */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-900">SEO &amp; Open Graph</h3>
            <p className="mt-1 text-xs text-slate-500">
              Optional. Empty fields fall back to the title / excerpt /
              featured image so basic posts still produce valid OG previews.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="SEO title"
                name="seoTitle"
                value={form.seoTitle}
                onChange={(e) => update('seoTitle', e.target.value)}
                placeholder="Defaults to title"
              />
              <Input
                label="OG title"
                name="ogTitle"
                value={form.ogTitle}
                onChange={(e) => update('ogTitle', e.target.value)}
                placeholder="Defaults to SEO title"
              />
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  SEO meta description
                </label>
                <textarea
                  rows={2}
                  value={form.seoDescription}
                  onChange={(e) => update('seoDescription', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  placeholder="Defaults to excerpt"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  OG description
                </label>
                <textarea
                  rows={2}
                  value={form.ogDescription}
                  onChange={(e) => update('ogDescription', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  placeholder="Defaults to SEO description"
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="OG image URL"
                  name="ogImage"
                  value={form.ogImage}
                  onChange={(e) => update('ogImage', e.target.value)}
                  placeholder="Defaults to the featured image"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Side rail — status + featured + category + tags */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-semibold text-slate-900">Publish</h3>
            <div className="mt-3 space-y-3">
              <Select
                label="Status"
                name="status"
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                options={STATUS_OPTIONS}
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    {isEdit ? 'Save changes' : 'Create post'}
                  </>
                )}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  Featured image
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Uploaded files land in <code className="rounded bg-slate-100 px-1">frontend/public/blog-images/</code> so Next.js serves them as static assets.
                </p>
              </div>
              {isEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={runAiImage}
                  disabled={aiImageBusy}
                  title="Generate a new featured image with Gemini (falls back to Unsplash if Gemini isn't configured)."
                >
                  {aiImageBusy ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      Generate with AI
                    </>
                  )}
                </Button>
              ) : null}
            </div>
            {form.featuredImage ? (
              <div className="mt-3">
                <img
                  src={form.featuredImage}
                  alt="Featured"
                  className="aspect-[16/10] w-full rounded-lg border border-slate-200 object-cover"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[10px] text-slate-500">
                    {form.featuredImage}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => update('featuredImage', '')}
                  >
                    <X size={13} />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-3 py-6 text-sm font-medium text-slate-500 transition hover:border-amber-400 hover:text-amber-700">
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <ImageIcon size={16} />
                    Upload image
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImage}
                  disabled={uploading}
                />
              </label>
            )}
            <Input
              label="Or paste image URL"
              name="featuredImage"
              value={form.featuredImage}
              onChange={(e) => update('featuredImage', e.target.value)}
              placeholder="/blog-images/foo.jpg or https://…"
              className="mt-3"
            />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-900">Category</h3>
            <Select
              label="Category"
              name="categoryId"
              value={form.categoryId}
              onChange={(e) => update('categoryId', e.target.value)}
              options={[
                { value: '', label: 'No category' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              className="mt-3"
            />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-900">Tags</h3>
            <p className="mt-1 text-xs text-slate-500">
              Click to toggle.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No tags yet — create them under Blog → Tags.
                </p>
              ) : (
                tags.map((t) => {
                  const on = form.tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        on
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800'
                      }`}
                    >
                      #{t.name}
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
