'use client';

// Admin → Posts → Insta & YouTube posts.
//
// The daily Hindi legal-news carousel module. Lists every generated deck
// (draft / posted / failed), shows the rendered 1:1 cards, and lets an admin
// generate today's deck on demand and approve → post it to Buffer (Instagram
// carousel + YouTube). Fully-automatic daily posting is controlled by the
// social_auto_post setting under Admin → Settings → AI / Anthropic.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Instagram,
  Youtube,
  Plus,
  RefreshCw,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Hash,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import EmptyState from '@/components/common/EmptyState';
import {
  getSocialStatus,
  listSocialPosts,
  generateSocialPost,
  postSocialPost,
  deleteSocialPost,
} from '@/services/socialService';
import { formatDate } from '@/utils/formatters';
import { ROLES } from '@/utils/constants';

const STATUS_VARIANT = {
  draft: 'gray',
  posted: 'green',
  failed: 'red',
  archived: 'amber',
};

export default function AdminSocialPage() {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ items }, st] = await Promise.all([
        listSocialPosts({ limit: 30 }),
        getSocialStatus().catch(() => null),
      ]);
      setPosts(items);
      setStatus(st);
    } catch (err) {
      setError(err?.message || 'Failed to load social posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const row = await generateSocialPost(false);
      setNotice(
        `Generated a ${row?.kind === 'knowledge' ? 'legal-knowledge' : 'news'} deck with ${
          (row?.imageUrls || []).length
        } cards — review and post it below.`
      );
      await load();
    } catch (err) {
      setError(err?.message || 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePost(id) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const row = await postSocialPost(id);
      if (row?.status === 'posted') {
        setNotice('Posted to Buffer — Instagram + YouTube.');
      } else {
        setError(row?.lastError || 'Buffer did not accept the post.');
      }
      await load();
    } catch (err) {
      setError(err?.message || 'Posting failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this deck? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await deleteSocialPost(id);
      await load();
    } catch (err) {
      setError(err?.message || 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Insta & YouTube posts"
      subtitle="Daily Hindi legal & tax news carousel for Instagram + YouTube"
    >
      <div className="space-y-6">
        {/* Status + actions */}
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <Instagram size={16} className="text-pink-600" /> Instagram
                  <span className="text-slate-300">·</span>
                  <Youtube size={16} className="text-red-600" /> YouTube
                </span>
                {status && (
                  <Badge variant={status.bufferConfigured ? 'green' : 'red'}>
                    {status.bufferConfigured ? 'Buffer connected' : 'Buffer token missing'}
                  </Badge>
                )}
                {status && (
                  <Badge variant={status.autoPost ? 'green' : 'gray'}>
                    {status.autoPost ? 'Auto-posting ON' : 'Draft-for-approval'}
                  </Badge>
                )}
                {status && (
                  <Badge variant="blue">{status.perDay} cards/day</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Content is written by Claude in Hindi, rendered as 1:1 cards, and never repeats a
                past story.{' '}
                <Link href="/admin/settings" className="text-blue-600 hover:underline">
                  Configure the Buffer token & auto-post
                </Link>
                .
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={load} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
              </Button>
              <Button variant="primary" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {generating ? 'Generating…' : "Generate today's deck"}
              </Button>
            </div>
          </div>

          {!status?.bufferConfigured && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                Add the Instagram/YouTube Buffer access token under Admin → Settings → AI /
                Anthropic → “Buffer access token (Instagram + YouTube)”. You can still generate and
                preview drafts without it.
              </span>
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          {notice && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {notice}
            </div>
          )}
        </Card>

        {/* List */}
        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Instagram size={24} />}
              title="No decks yet"
              description="Generate today's carousel to see the cards, caption and hashtags before posting."
            />
          </Card>
        ) : (
          <div className="space-y-5">
            {posts.map((p) => (
              <SocialPostCard
                key={p.id}
                post={p}
                busy={busyId === p.id}
                bufferConfigured={status?.bufferConfigured}
                onPost={() => handlePost(p.id)}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SocialPostCard({ post, busy, bufferConfigured, onPost, onDelete }) {
  const images = Array.isArray(post.imageUrls) ? post.imageUrls : [];
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
  const canPost = post.status !== 'posted' && images.length > 0;

  return (
    <Card>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[post.status] || 'gray'}>{post.status}</Badge>
            <Badge variant={post.kind === 'knowledge' ? 'amber' : 'blue'}>
              {post.kind === 'knowledge' ? 'Legal knowledge' : 'News'}
            </Badge>
            <span className="text-xs uppercase tracking-wide text-slate-400">
              {post.language === 'hi' ? 'हिंदी' : post.language}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} /> {formatDate(post.createdAt)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={onPost}
              disabled={busy || !canPost || !bufferConfigured}
              title={
                !bufferConfigured
                  ? 'Add the social Buffer token first'
                  : post.status === 'posted'
                    ? 'Already posted'
                    : 'Approve & post to Instagram + YouTube'
              }
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {post.status === 'posted' ? 'Posted' : 'Approve & post'}
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} disabled={busy}>
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <p className="text-sm font-semibold text-slate-800">{post.title}</p>

        {/* Card strip */}
        {images.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={`Slide ${i + 1}`}
                width={160}
                height={160}
                className="h-40 w-40 shrink-0 rounded-xl border border-slate-200 object-cover"
              />
            ))}
          </div>
        )}

        {/* Caption + hashtags */}
        {post.caption && (
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {post.caption}
          </p>
        )}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((h) => (
              <span
                key={h}
                className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
              >
                <Hash size={11} />
                {String(h).replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}

        {/* Post result / errors */}
        {post.status === 'failed' && post.lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {post.lastError}
          </div>
        )}
        {post.status === 'posted' && (
          <p className="text-xs text-green-700">
            Posted {post.postedAt ? `on ${formatDate(post.postedAt)}` : ''} to{' '}
            {(post.postResult?.services || []).join(', ') || 'Buffer'}.
          </p>
        )}
        {Array.isArray(post.postResult?.skippedChannels) &&
          post.postResult.skippedChannels.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {post.postResult.skippedChannels.map((s) => (
                <span key={s.channelId} className="inline-flex items-center gap-1.5">
                  <Youtube size={12} className="text-red-500" />
                  <span className="font-medium capitalize">{s.service}</span> skipped — {s.reason}
                </span>
              ))}
            </div>
          )}
      </div>
    </Card>
  );
}
