// blogService — CRUD for categories, tags and posts plus the public read
// path used by /blog and /blog/[slug]. Slugs are auto-derived from names
// and the post's title; the admin can override slug at save time.

const { Op, literal } = require('sequelize');
const {
  BlogCategory,
  BlogTag,
  BlogPost,
  User,
} = require('../models');

const POST_STATUSES = ['draft', 'published', 'archived'];

// --- Helpers --------------------------------------------------------------

/**
 * Turn arbitrary text into a URL-safe slug:
 *   "Hello, World! 2026" → "hello-world-2026"
 * Limited to 80 chars for tags/categories, 200 for posts (callers slice).
 */
const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Ensure a slug is unique against the supplied model. Walks "slug, slug-2,
 * slug-3" until it finds an opening.
 */
const ensureUniqueSlug = async (Model, baseSlug, ignoreId = null) => {
  let candidate = baseSlug || 'post';
  let n = 2;
  while (true) {
    const where = { slug: candidate };
    if (ignoreId) where.id = { [Op.ne]: ignoreId };
    const existing = await Model.findOne({ where });
    if (!existing) return candidate;
    candidate = `${baseSlug}-${n++}`;
  }
};

// Approx reading time: 220 words / minute. Avoids importing a markdown
// parser just for stats. HTML tags are stripped for the word count.
const readingMinutes = (html) => {
  const text = String(html || '').replace(/<[^>]+>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
};

// --- Categories -----------------------------------------------------------

const listCategories = async () =>
  BlogCategory.findAll({
    order: [
      ['sortOrder', 'ASC'],
      ['name', 'ASC'],
    ],
    raw: true,
  });

const createCategory = async (data = {}) => {
  const name = String(data.name || '').trim();
  if (!name) throw { statusCode: 422, message: 'Category name is required.' };
  const slugBase = (data.slug && slugify(data.slug)) || slugify(name) || 'category';
  const slug = await ensureUniqueSlug(BlogCategory, slugBase);
  return BlogCategory.create({
    name,
    slug,
    description: data.description || null,
    sortOrder: Number(data.sortOrder) || 0,
  }).then((c) => c.get({ plain: true }));
};

const updateCategory = async (id, data = {}) => {
  const row = await BlogCategory.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Category not found.' };
  const patch = {};
  if (data.name !== undefined) patch.name = String(data.name).trim();
  if (data.description !== undefined) patch.description = data.description || null;
  if (data.sortOrder !== undefined) patch.sortOrder = Number(data.sortOrder) || 0;
  if (data.slug !== undefined) {
    const slugBase = slugify(data.slug) || slugify(patch.name || row.name);
    patch.slug = await ensureUniqueSlug(BlogCategory, slugBase, row.id);
  }
  await row.update(patch);
  return row.get({ plain: true });
};

const deleteCategory = async (id) => {
  const row = await BlogCategory.findByPk(id);
  if (!row) return null;
  // Posts that referenced this category lose the link; we set null rather
  // than block delete — categories are admin-managed and reorganisations
  // are common.
  await BlogPost.update({ categoryId: null }, { where: { categoryId: id } });
  await row.destroy();
  return row.get({ plain: true });
};

// --- Tags -----------------------------------------------------------------

const listTags = async () =>
  BlogTag.findAll({
    order: [['name', 'ASC']],
    raw: true,
  });

const createTag = async (data = {}) => {
  const name = String(data.name || '').trim();
  if (!name) throw { statusCode: 422, message: 'Tag name is required.' };
  const slugBase = (data.slug && slugify(data.slug)) || slugify(name) || 'tag';
  const slug = await ensureUniqueSlug(BlogTag, slugBase);
  return BlogTag.create({ name, slug }).then((t) => t.get({ plain: true }));
};

const updateTag = async (id, data = {}) => {
  const row = await BlogTag.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Tag not found.' };
  const patch = {};
  if (data.name !== undefined) patch.name = String(data.name).trim();
  if (data.slug !== undefined) {
    const slugBase = slugify(data.slug) || slugify(patch.name || row.name);
    patch.slug = await ensureUniqueSlug(BlogTag, slugBase, row.id);
  }
  await row.update(patch);
  return row.get({ plain: true });
};

const deleteTag = async (id) => {
  const row = await BlogTag.findByPk(id);
  if (!row) return null;
  // Strip the tag from every post that carried it.
  //
  // NOTE: blog_posts.tagIds is declared DataTypes.JSON on the model
  // but the underlying MySQL column is LONGTEXT. When we do a
  // { tagIds: { [Op.like]: … } } predicate, Sequelize applies the
  // JSON serialiser to the RHS and wraps the LIKE pattern in
  // double-quotes ('"%…"%'), which never matches the raw JSON blob.
  // We bypass the serialiser with a raw literal — the id is
  // server-generated ("blogtag-<ts>-<n>") and can't contain a quote.
  const posts = await BlogPost.findAll({
    where: { [Op.and]: [literal(`\`tagIds\` LIKE '%${id}%'`)] },
  });
  for (const p of posts) {
    const next = Array.isArray(p.tagIds)
      ? p.tagIds.filter((t) => t !== id)
      : [];
    await p.update({ tagIds: next });
  }
  await row.destroy();
  return row.get({ plain: true });
};

// --- Posts ----------------------------------------------------------------

// Decorate a post with the resolved category + tag rows so a single API
// call can power the detail page (no follow-up requests).
const decoratePost = async (post) => {
  if (!post) return null;
  const plain = typeof post.get === 'function' ? post.get({ plain: true }) : post;
  const [category, tags] = await Promise.all([
    plain.categoryId ? BlogCategory.findByPk(plain.categoryId, { raw: true }) : null,
    Array.isArray(plain.tagIds) && plain.tagIds.length > 0
      ? BlogTag.findAll({ where: { id: { [Op.in]: plain.tagIds } }, raw: true })
      : Promise.resolve([]),
  ]);
  return { ...plain, category, tags };
};

const decoratePosts = async (posts) => {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  // Batch the lookups so a 20-row list doesn't fire 40 queries.
  const categoryIds = [...new Set(posts.map((p) => p.categoryId).filter(Boolean))];
  const tagIdSet = new Set();
  for (const p of posts) {
    if (Array.isArray(p.tagIds)) for (const t of p.tagIds) tagIdSet.add(t);
  }
  const [cats, tags] = await Promise.all([
    categoryIds.length
      ? BlogCategory.findAll({ where: { id: { [Op.in]: categoryIds } }, raw: true })
      : [],
    tagIdSet.size
      ? BlogTag.findAll({ where: { id: { [Op.in]: [...tagIdSet] } }, raw: true })
      : [],
  ]);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  return posts.map((p) => ({
    ...p,
    category: p.categoryId ? catById.get(p.categoryId) || null : null,
    tags: Array.isArray(p.tagIds)
      ? p.tagIds.map((id) => tagById.get(id)).filter(Boolean)
      : [],
  }));
};

/**
 * Public listing — published posts only, newest first. Optional filters by
 * category slug / tag slug / search query.
 */
const listPublicPosts = async ({
  page = 1,
  limit = 12,
  categorySlug,
  tagSlug,
  search,
} = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 50));
  const offset = (safePage - 1) * safeLimit;

  const where = { status: 'published' };
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { title: { [Op.like]: q } },
      { excerpt: { [Op.like]: q } },
    ];
  }
  if (categorySlug) {
    const cat = await BlogCategory.findOne({
      where: { slug: categorySlug },
      raw: true,
    });
    if (!cat) return { items: [], page: safePage, limit: safeLimit, total: 0 };
    where.categoryId = cat.id;
  }
  if (tagSlug) {
    const tag = await BlogTag.findOne({ where: { slug: tagSlug }, raw: true });
    if (!tag) return { items: [], page: safePage, limit: safeLimit, total: 0 };
    // tagIds is DataTypes.JSON on the model but LONGTEXT in the DB.
    // A plain { [Op.like]: … } predicate would be JSON-serialised
    // ('"%…"%') by Sequelize's type layer and match nothing. Use a
    // raw literal so the pattern lands as a plain '%…%'. Tag ids
    // are server-generated in the form "blogtag-<ts>-<n>" — no
    // quotes or wildcards to escape.
    where[Op.and] = [
      ...(where[Op.and] || []),
      literal(`\`tagIds\` LIKE '%${tag.id}%'`),
    ];
  }

  const { rows, count } = await BlogPost.findAndCountAll({
    where,
    order: [
      ['publishedAt', 'DESC'],
      ['createdAt', 'DESC'],
    ],
    limit: safeLimit,
    offset,
    raw: true,
  });
  const items = await decoratePosts(rows);
  return { items, page: safePage, limit: safeLimit, total: count };
};

const getPublicPost = async (slug) => {
  const post = await BlogPost.findOne({
    where: { slug, status: 'published' },
    raw: true,
  });
  return decoratePost(post);
};

// --- Admin posts ----------------------------------------------------------

const adminListPosts = async ({ page = 1, limit = 30, status, search } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100));
  const offset = (safePage - 1) * safeLimit;

  const where = {};
  if (status && POST_STATUSES.includes(status)) where.status = status;
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { title: { [Op.like]: q } },
      { slug: { [Op.like]: q } },
    ];
  }
  const { rows, count } = await BlogPost.findAndCountAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit: safeLimit,
    offset,
    raw: true,
  });
  const items = await decoratePosts(rows);
  return { items, page: safePage, limit: safeLimit, total: count };
};

const adminGetPost = async (id) => {
  const post = await BlogPost.findByPk(id, { raw: true });
  return decoratePost(post);
};

// Normalise / validate the inbound post payload.
const buildPostPatch = async (data = {}, existingRow = null) => {
  const patch = {};
  if (data.title !== undefined) {
    patch.title = String(data.title).trim();
    if (!patch.title) {
      throw { statusCode: 422, message: 'Title is required.' };
    }
  }
  if (data.slug !== undefined || data.title !== undefined) {
    const fallback = patch.title || (existingRow && existingRow.title) || 'post';
    const base = slugify(data.slug || fallback).slice(0, 200) || 'post';
    patch.slug = await ensureUniqueSlug(
      BlogPost,
      base,
      existingRow ? existingRow.id : null
    );
  }
  if (data.excerpt !== undefined) patch.excerpt = data.excerpt || null;
  if (data.content !== undefined) {
    patch.content = String(data.content || '');
    if (!patch.content.trim()) {
      throw { statusCode: 422, message: 'Content is required.' };
    }
    patch.readingMinutes = readingMinutes(patch.content);
  }
  if (data.featuredImage !== undefined) {
    patch.featuredImage = data.featuredImage || null;
  }
  if (data.categoryId !== undefined) {
    patch.categoryId = data.categoryId || null;
  }
  if (data.tagIds !== undefined) {
    patch.tagIds = Array.isArray(data.tagIds)
      ? data.tagIds.filter(Boolean)
      : [];
  }
  if (data.status !== undefined) {
    const next = String(data.status).toLowerCase();
    if (!POST_STATUSES.includes(next)) {
      throw {
        statusCode: 422,
        message: `Status must be one of: ${POST_STATUSES.join(', ')}`,
      };
    }
    patch.status = next;
    // Stamp publishedAt the first time a post is published.
    if (next === 'published') {
      if (!existingRow || !existingRow.publishedAt) {
        patch.publishedAt = new Date();
      }
    }
  }
  if (data.seoTitle !== undefined) patch.seoTitle = data.seoTitle || null;
  if (data.seoDescription !== undefined)
    patch.seoDescription = data.seoDescription || null;
  if (data.ogTitle !== undefined) patch.ogTitle = data.ogTitle || null;
  if (data.ogDescription !== undefined)
    patch.ogDescription = data.ogDescription || null;
  if (data.ogImage !== undefined) patch.ogImage = data.ogImage || null;
  return patch;
};

const adminCreatePost = async (data = {}, actor = null) => {
  const patch = await buildPostPatch(data);
  if (!patch.title) {
    throw { statusCode: 422, message: 'Title is required.' };
  }
  if (!patch.content) {
    throw { statusCode: 422, message: 'Content is required.' };
  }
  const authorName = data.authorName || (actor && (actor.fullName || actor.name)) || null;
  const post = await BlogPost.create({
    ...patch,
    authorUserId: actor && actor.id ? actor.id : null,
    authorName,
  });
  return decoratePost(post.get({ plain: true }));
};

const adminUpdatePost = async (id, data = {}) => {
  const row = await BlogPost.findByPk(id);
  if (!row) throw { statusCode: 404, message: 'Post not found.' };
  const patch = await buildPostPatch(data, row.get({ plain: true }));
  await row.update(patch);
  return decoratePost(row.get({ plain: true }));
};

const adminDeletePost = async (id) => {
  const row = await BlogPost.findByPk(id);
  if (!row) return null;
  await row.destroy();
  return row.get({ plain: true });
};

module.exports = {
  POST_STATUSES,
  slugify,
  // Categories
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Tags
  listTags,
  createTag,
  updateTag,
  deleteTag,
  // Posts (public)
  listPublicPosts,
  getPublicPost,
  // Posts (admin)
  adminListPosts,
  adminGetPost,
  adminCreatePost,
  adminUpdatePost,
  adminDeletePost,
};
