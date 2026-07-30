'use client';

// Admin blog overview — paginated list of every post (any status) with
// quick stats and a CTA to the new-post form. Categories + Tags get their
// own pages reachable via the sidebar dropdown.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Newspaper,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Search,
  ExternalLink,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import {
  adminListPosts,
  adminDeletePost,
  adminAiGeneratePost,
} from '@/services/blogService';
import { formatDate } from '@/utils/formatters';
import { ROLES } from '@/utils/constants';

const STATUS_VARIANT = {
  draft: 'gray',
  published: 'green',
  archived: 'amber',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

export default function AdminBlogPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // AI generate flow — synchronous server call (~30-90s). Banner
  // tracks progress + result; "Open draft" routes the admin straight
  // to the editor when the post lands.
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null); // { ok, message, postId?, slug?, topic? }
  async function runAiGenerate() {
    if (aiGenerating) return;
    setAiGenerating(true);
    setAiResult({
      ok: null,
      message:
        'Researching trending legal topics → drafting the post → generating a featured image → assigning category & tags → publishing → sharing to Buffer… usually 45-90 seconds.',
    });
    try {
      const res = await adminAiGeneratePost();
      const post = res && res.post;
      const parts = [`Published "${(post && post.title) || 'untitled'}".`];
      if (res.image && res.image.url) parts.push('Featured image attached.');
      if (res.buffer && Array.isArray(res.buffer.services) && res.buffer.services.length) {
        parts.push(`Shared to ${res.buffer.services.join(', ')} via Buffer.`);
      } else if (res.buffer && res.buffer.skipped) {
        parts.push(`Buffer share skipped (${res.buffer.reason}).`);
      }
      parts.push(`Took ${Number(res.elapsedSeconds || 0).toFixed(1)}s.`);
      setAiResult({
        ok: true,
        message: parts.join(' '),
        postId: post && post.id,
        slug: post && post.slug,
        topic: res.pick && res.pick.topic,
      });
      await load();
    } catch (err) {
      setAiResult({
        ok: false,
        message: err?.message || 'AI generation failed.',
      });
    } finally {
      setAiGenerating(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { items, meta: m } = await adminListPosts({
        status: status || undefined,
        search: search || undefined,
        limit: 30,
      });
      setRows(items);
      setMeta(m);
    } catch (err) {
      setError(err.message || 'Failed to load posts.');
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await adminDeletePost(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete the post.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Blog · Posts"
      subtitle="Every post on the journal — drafts, published and archived"
    >
      <div className="space-y-6">
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <div className="sm:col-span-2">
              <Input
                label="Search"
                name="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Title or slug"
              />
            </div>
            <Select
              label="Status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={STATUS_OPTIONS}
            />
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button type="submit" variant="outline">
                <Search size={15} />
                Apply
              </Button>
            </div>
          </form>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Newspaper size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading…'
                : `${(meta && meta.total) || rows.length} post${
                    (meta && meta.total) === 1 ? '' : 's'
                  }`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={runAiGenerate}
              disabled={aiGenerating}
              title="Research trending Indian legal news → draft → generate featured image → assign category & tags → publish → share to Buffer (Twitter / Facebook / LinkedIn). End to end in ~60s."
              className="!bg-orange-500 hover:!bg-orange-600"
            >
              {aiGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Generating &amp; sharing…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Generate, publish &amp; share
                </>
              )}
            </Button>
            <Button href="/admin/blog/posts/new" size="sm">
              <Plus size={15} />
              New post
            </Button>
          </div>
        </div>

        {aiResult && (
          <div
            className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between ${
              aiResult.ok === true
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : aiResult.ok === false
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-800'
            }`}
          >
            <div className="flex items-start gap-2">
              {aiResult.ok === true ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : aiResult.ok === false ? (
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              ) : (
                <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
              )}
              <div>
                {aiResult.topic && (
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Topic: {aiResult.topic}
                  </p>
                )}
                <p>{aiResult.message}</p>
              </div>
            </div>
            {aiResult.ok === true && aiResult.postId ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAiResult(null)}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(`/admin/blog/posts/${aiResult.postId}/edit`)
                  }
                >
                  <ExternalLink size={13} />
                  Open draft
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Newspaper size={24} />}
            title="No posts yet"
            description="Start by writing your first post or adjusting the filters."
            action={
              <Button href="/admin/blog/posts/new">
                <Plus size={15} />
                New post
              </Button>
            }
          />
        ) : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/blog/posts/${p.id}/edit`}
                          className="block max-w-md truncate font-medium text-slate-800 hover:text-amber-700"
                        >
                          {p.title}
                        </Link>
                        <p className="font-mono text-[11px] text-slate-400">
                          /{p.slug}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.category ? p.category.name : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[p.status] || 'gray'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(p.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.status === 'published' && (
                            <Button
                              size="sm"
                              variant="outline"
                              href={`/blog/${p.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open public page"
                              aria-label="Open public page"
                            >
                              <ExternalLink size={14} />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            href={`/admin/blog/posts/${p.id}/edit`}
                            title="Edit"
                            aria-label="Edit"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteTarget(p)}
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete post"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{deleteTarget.title}</strong>? This
            cannot be undone.
          </p>
        )}
      </Modal>
    </DashboardLayout>
  );
}
