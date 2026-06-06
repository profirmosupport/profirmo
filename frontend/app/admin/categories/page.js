'use client';

// Admin — App Settings: categories + sub-categories.
// Lists every Category as a collapsible card; each card lets the admin
// rename / toggle / delete the Category and add / edit / delete its
// SubCategory rows. Drives every category dropdown across the platform.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ListTree,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { ROLES } from '@/utils/constants';
import {
  adminListCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminCreateSubCategory,
  adminUpdateSubCategory,
  adminDeleteSubCategory,
} from '@/services/appSettingsService';
import { invalidateAppSettings } from '@/hooks/useAppSettings';

const EMPTY_CATEGORY_FORM = { name: '', sortOrder: 0, active: true };
const EMPTY_SUB_FORM = {
  name: '',
  sortOrder: 0,
  active: true,
  featured: false,
};

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-24 w-full animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function AdminCategoriesPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  // Per-sub-category expand state for the nested tree
  // (tier-1 row expands to reveal its tier-2 children, etc.).
  const [expandedSubs, setExpandedSubs] = useState(() => new Set());

  // Category create/edit/delete modals.
  const [catModal, setCatModal] = useState(null); // { mode, target?, form }
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [catError, setCatError] = useState('');

  // Sub-category modals.
  const [subModal, setSubModal] = useState(null); // { mode, categoryId, target?, form }
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subError, setSubError] = useState('');

  const isAdmin = user && user.role === ROLES.PLATFORM_ADMIN;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminListCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) load();
  }, [authLoading, isAuthenticated, isAdmin, load]);

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSubExpand(id) {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function expandSubChain(ids) {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => id && next.add(id));
      return next;
    });
  }

  // ----- Category modal helpers -------------------------------------------

  function openCatCreate() {
    setCatError('');
    setCatModal({ mode: 'create', form: { ...EMPTY_CATEGORY_FORM } });
  }
  function openCatEdit(cat) {
    setCatError('');
    setCatModal({
      mode: 'edit',
      target: cat,
      form: {
        name: cat.name,
        sortOrder: cat.sortOrder || 0,
        active: !!cat.active,
      },
    });
  }
  function openCatDelete(cat) {
    setCatError('');
    setCatModal({ mode: 'delete', target: cat });
  }
  function closeCat() {
    if (catSubmitting) return;
    setCatModal(null);
    setCatError('');
  }

  async function submitCat(e) {
    if (e) e.preventDefault();
    if (!catModal || catSubmitting) return;
    setCatSubmitting(true);
    setCatError('');
    try {
      if (catModal.mode === 'create') {
        await adminCreateCategory({
          name: catModal.form.name.trim(),
          sortOrder: Number(catModal.form.sortOrder) || 0,
          active: catModal.form.active,
        });
      } else if (catModal.mode === 'edit') {
        await adminUpdateCategory(catModal.target.id, {
          name: catModal.form.name.trim(),
          sortOrder: Number(catModal.form.sortOrder) || 0,
          active: catModal.form.active,
        });
      } else if (catModal.mode === 'delete') {
        await adminDeleteCategory(catModal.target.id);
      }
      invalidateAppSettings();
      setCatModal(null);
      await load();
    } catch (err) {
      setCatError(err.message || 'Operation failed.');
    } finally {
      setCatSubmitting(false);
    }
  }

  // ----- Sub-category modal helpers ---------------------------------------

  function openSubCreate(category, parentSub) {
    setSubError('');
    setSubModal({
      mode: 'create',
      categoryId: category.id,
      categoryName: category.name,
      parentSubCategoryId: parentSub ? parentSub.id : null,
      parentSubName: parentSub ? parentSub.name : null,
      form: { ...EMPTY_SUB_FORM },
    });
  }
  function openSubEdit(category, sub) {
    setSubError('');
    setSubModal({
      mode: 'edit',
      categoryId: category.id,
      categoryName: category.name,
      parentSubCategoryId: sub.parentSubCategoryId || null,
      target: sub,
      form: {
        name: sub.name,
        sortOrder: sub.sortOrder || 0,
        active: !!sub.active,
        featured: !!sub.featured,
      },
    });
  }
  function openSubDelete(category, sub) {
    setSubError('');
    setSubModal({
      mode: 'delete',
      categoryId: category.id,
      categoryName: category.name,
      target: sub,
    });
  }
  function closeSub() {
    if (subSubmitting) return;
    setSubModal(null);
    setSubError('');
  }

  async function submitSub(e) {
    if (e) e.preventDefault();
    if (!subModal || subSubmitting) return;
    setSubSubmitting(true);
    setSubError('');
    try {
      if (subModal.mode === 'create') {
        await adminCreateSubCategory({
          categoryId: subModal.categoryId,
          parentSubCategoryId: subModal.parentSubCategoryId || null,
          name: subModal.form.name.trim(),
          sortOrder: Number(subModal.form.sortOrder) || 0,
          active: subModal.form.active,
          featured: subModal.form.featured,
        });
        if (subModal.parentSubCategoryId) {
          expandSubChain([subModal.parentSubCategoryId]);
        }
      } else if (subModal.mode === 'edit') {
        await adminUpdateSubCategory(subModal.target.id, {
          name: subModal.form.name.trim(),
          sortOrder: Number(subModal.form.sortOrder) || 0,
          active: subModal.form.active,
          featured: subModal.form.featured,
        });
      } else if (subModal.mode === 'delete') {
        await adminDeleteSubCategory(subModal.target.id);
      }
      invalidateAppSettings();
      setSubModal(null);
      await load();
    } catch (err) {
      setSubError(err.message || 'Operation failed.');
    } finally {
      setSubSubmitting(false);
    }
  }

  // ----- Guards ------------------------------------------------------------

  if (authLoading || !isAuthenticated) {
    return <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Professional Categories" />;
  }
  if (!isAdmin) {
    return (
      <DashboardLayout role={ROLES.PLATFORM_ADMIN} title="Professional Categories">
        <EmptyState
          icon={<ShieldAlert size={24} />}
          title="Access denied"
          description="You need a platform administrator account to manage categories."
          action={
            <Button href="/dashboard" variant="outline">
              Back to dashboard
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={ROLES.PLATFORM_ADMIN}
      title="Categories & sub-categories"
      subtitle="Drive every profession dropdown on the platform"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <ListTree size={18} />
            </span>
            <p className="text-sm font-medium text-slate-700">
              {loading
                ? 'Loading…'
                : `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCatCreate}>
              <Plus size={15} />
              Add category
            </Button>
          </div>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </span>
              <p className="text-sm font-medium text-slate-700">{error}</p>
              <Button size="sm" onClick={load}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          </Card>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={<ListTree size={24} />}
            title="No categories yet"
            description="Create your first category to start populating the profession dropdowns."
            action={<Button onClick={openCatCreate}>Add category</Button>}
          />
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => {
              const isOpen = expanded.has(cat.id);
              const subs = cat.subCategories || [];

              // Group sub-categories by parent id so we can walk the
              // tree without N² lookups. Each bucket is sort-ordered.
              const childrenByParent = new Map();
              for (const s of subs) {
                const pid = s.parentSubCategoryId || null;
                if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
                childrenByParent.get(pid).push(s);
              }
              for (const arr of childrenByParent.values()) {
                arr.sort(
                  (a, b) =>
                    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
                    String(a.name).localeCompare(String(b.name))
                );
              }
              const tier1 = childrenByParent.get(null) || [];

              // Tier-3 label varies by category — Legal calls them
              // "Practice areas", Tax calls them "Tags", everything
              // else falls back to a generic "Item".
              const catSlug = String(cat.slug || '').toLowerCase();
              const tier3Label =
                catSlug === 'legal'
                  ? 'Practice area'
                  : catSlug === 'tax'
                    ? 'Tag'
                    : 'Item';
              const tierLabel = (depth) => {
                if (depth === 0) return 'Sub-category';
                if (depth === 1) return 'Sub-sub-category';
                return tier3Label;
              };

              const renderSubRow = (row, depth) => {
                const children = childrenByParent.get(row.id) || [];
                const hasChildren = children.length > 0;
                const open = expandedSubs.has(row.id);
                return (
                  <li key={row.id} className="space-y-2">
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      style={{ marginLeft: depth * 20 }}
                    >
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            hasChildren && toggleSubExpand(row.id)
                          }
                          className={`flex h-5 w-5 items-center justify-center rounded ${
                            hasChildren
                              ? 'text-slate-500 hover:bg-slate-200'
                              : 'text-transparent'
                          }`}
                          aria-label={open ? 'Collapse' : 'Expand'}
                        >
                          {hasChildren ? (
                            open ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )
                          ) : (
                            <span className="block h-2 w-2 rounded-full bg-slate-300" />
                          )}
                        </button>
                        <span className="text-sm font-medium text-slate-800">
                          {row.name}
                        </span>
                        <Badge variant={row.active ? 'green' : 'gray'}>
                          {row.active ? 'Active' : 'Hidden'}
                        </Badge>
                        {row.featured && (
                          <Badge variant="amber">Featured</Badge>
                        )}
                        {hasChildren && (
                          <span className="text-xs text-slate-500">
                            {children.length} {tierLabel(depth + 1).toLowerCase()}
                            {children.length === 1 ? '' : 's'}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          Sort #{row.sortOrder}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSubCreate(cat, row)}
                          title={`Add ${tierLabel(depth + 1).toLowerCase()}`}
                        >
                          <Plus size={14} />
                          Add child
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSubEdit(cat, row)}
                        >
                          <Pencil size={14} />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSubDelete(cat, row)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </div>
                    </div>
                    {open && hasChildren && (
                      <ul className="space-y-2">
                        {children.map((c) => renderSubRow(c, depth + 1))}
                      </ul>
                    )}
                  </li>
                );
              };

              return (
                <Card key={cat.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(cat.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown size={18} className="text-slate-500" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-500" />
                      )}
                      <h3 className="text-base font-semibold text-slate-900">
                        {cat.name}
                      </h3>
                      <Badge variant={cat.active ? 'green' : 'gray'}>
                        {cat.active ? 'Active' : 'Hidden'}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {tier1.length} top-level · {subs.length} total
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCatEdit(cat)}
                      >
                        <Pencil size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCatDelete(cat)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">
                          Sub-categories
                        </p>
                        <Button size="sm" onClick={() => openSubCreate(cat)}>
                          <Plus size={14} />
                          Add sub-category
                        </Button>
                      </div>
                      {tier1.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No sub-categories yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {tier1.map((s) => renderSubRow(s, 0))}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Category create / edit modal */}
      <Modal
        open={!!catModal && catModal.mode !== 'delete'}
        onClose={closeCat}
        title={
          catModal && catModal.mode === 'edit' ? 'Edit category' : 'Add category'
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeCat}
              disabled={catSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitCat}
              disabled={catSubmitting}
            >
              {catSubmitting
                ? 'Saving…'
                : catModal && catModal.mode === 'edit'
                  ? 'Save changes'
                  : 'Create category'}
            </Button>
          </>
        }
      >
        {catModal && catModal.mode !== 'delete' && (
          <form onSubmit={submitCat} className="space-y-3">
            <Input
              label="Name"
              name="name"
              value={catModal.form.name}
              onChange={(e) =>
                setCatModal((m) => ({
                  ...m,
                  form: { ...m.form, name: e.target.value },
                }))
              }
              required
              placeholder="e.g. Legal"
            />
            <Input
              label="Sort order"
              name="sortOrder"
              type="number"
              value={catModal.form.sortOrder}
              onChange={(e) =>
                setCatModal((m) => ({
                  ...m,
                  form: { ...m.form, sortOrder: e.target.value },
                }))
              }
              hint="Lower numbers appear first"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={catModal.form.active}
                onChange={(e) =>
                  setCatModal((m) => ({
                    ...m,
                    form: { ...m.form, active: e.target.checked },
                  }))
                }
              />
              Active (visible in dropdowns)
            </label>
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
        {catError && <p className="mt-3 text-xs text-red-600">{catError}</p>}
      </Modal>

      {/* Category delete confirm */}
      <Modal
        open={!!catModal && catModal.mode === 'delete'}
        onClose={closeCat}
        title="Delete category"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeCat}
              disabled={catSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={submitCat}
              disabled={catSubmitting}
            >
              {catSubmitting ? 'Deleting…' : 'Delete category'}
            </Button>
          </>
        }
      >
        {catModal && catModal.mode === 'delete' && (
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{catModal.target.name}</strong> and every
            sub-category under it? Professionals who selected these
            sub-categories will lose those tags. This cannot be undone.
          </p>
        )}
        {catError && <p className="mt-3 text-xs text-red-600">{catError}</p>}
      </Modal>

      {/* Sub-category create / edit modal */}
      <Modal
        open={!!subModal && subModal.mode !== 'delete'}
        onClose={closeSub}
        title={
          subModal && subModal.mode === 'edit'
            ? `Edit sub-category — ${subModal.categoryName}`
            : subModal && subModal.parentSubName
              ? `Add under "${subModal.parentSubName}" — ${subModal.categoryName}`
              : `Add sub-category — ${subModal ? subModal.categoryName : ''}`
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeSub}
              disabled={subSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitSub}
              disabled={subSubmitting}
            >
              {subSubmitting
                ? 'Saving…'
                : subModal && subModal.mode === 'edit'
                  ? 'Save changes'
                  : 'Create sub-category'}
            </Button>
          </>
        }
      >
        {subModal && subModal.mode !== 'delete' && (
          <form onSubmit={submitSub} className="space-y-3">
            <Input
              label="Name"
              name="name"
              value={subModal.form.name}
              onChange={(e) =>
                setSubModal((m) => ({
                  ...m,
                  form: { ...m.form, name: e.target.value },
                }))
              }
              required
              placeholder="e.g. Family Lawyer"
            />
            <Input
              label="Sort order"
              name="sortOrder"
              type="number"
              value={subModal.form.sortOrder}
              onChange={(e) =>
                setSubModal((m) => ({
                  ...m,
                  form: { ...m.form, sortOrder: e.target.value },
                }))
              }
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={subModal.form.active}
                onChange={(e) =>
                  setSubModal((m) => ({
                    ...m,
                    form: { ...m.form, active: e.target.checked },
                  }))
                }
              />
              Active (visible in dropdowns)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={subModal.form.featured}
                onChange={(e) =>
                  setSubModal((m) => ({
                    ...m,
                    form: { ...m.form, featured: e.target.checked },
                  }))
                }
              />
              Featured (shown in the homepage &ldquo;Browse by area of
              expertise&rdquo; section)
            </label>
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
        )}
        {subError && <p className="mt-3 text-xs text-red-600">{subError}</p>}
      </Modal>

      {/* Sub-category delete confirm */}
      <Modal
        open={!!subModal && subModal.mode === 'delete'}
        onClose={closeSub}
        title="Delete sub-category"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={closeSub}
              disabled={subSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={submitSub}
              disabled={subSubmitting}
            >
              {subSubmitting ? 'Deleting…' : 'Delete sub-category'}
            </Button>
          </>
        }
      >
        {subModal && subModal.mode === 'delete' && (
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{subModal.target.name}</strong>?
            Professionals who selected this sub-category will lose this tag.
          </p>
        )}
        {subError && <p className="mt-3 text-xs text-red-600">{subError}</p>}
      </Modal>
    </DashboardLayout>
  );
}
