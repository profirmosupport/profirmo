// blogController — public read + admin CRUD for the blog module.
//
// The featured-image upload route writes directly to the frontend's
// `public/blog-images/` folder (or env.blogImageDir in production) so
// Next.js serves the images as static assets. That's important for SEO:
// crawlers + social scrapers fetch images straight from the page's own
// origin, no cross-origin redirects.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const {
  successResponse,
  paginatedResponse,
} = require('../utils/responseHandler');
const blogService = require('../services/blogService');
const storageService = require('../services/storageService');
const aiBlogService = require('../services/aiBlogService');
const { logAudit } = require('../utils/auditLogger');
const env = require('../config/env');

// --- Public routes --------------------------------------------------------

// GET /api/blog/posts?page=&limit=&categorySlug=&tagSlug=&search=
const listPosts = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await blogService.listPublicPosts({
    page: req.query.page,
    limit: req.query.limit,
    categorySlug: req.query.categorySlug,
    tagSlug: req.query.tagSlug,
    search: req.query.search,
  });
  return paginatedResponse(res, 'Blog posts', items, { page, limit, total });
});

// GET /api/blog/posts/:slug
const getPost = asyncHandler(async (req, res) => {
  const post = await blogService.getPublicPost(req.params.slug);
  if (!post) throw { statusCode: 404, message: 'Post not found.' };
  return successResponse(res, 200, 'Blog post', post);
});

// GET /api/blog/categories
const listCategories = asyncHandler(async (req, res) => {
  const items = await blogService.listCategories();
  return successResponse(res, 200, 'Blog categories', { items });
});

// GET /api/blog/tags
const listTags = asyncHandler(async (req, res) => {
  const items = await blogService.listTags();
  return successResponse(res, 200, 'Blog tags', { items });
});

// --- Admin routes ---------------------------------------------------------

const adminListPosts = asyncHandler(async (req, res) => {
  const { items, page, limit, total } = await blogService.adminListPosts({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    search: req.query.search,
  });
  return paginatedResponse(res, 'Blog posts', items, { page, limit, total });
});

const adminGetPost = asyncHandler(async (req, res) => {
  const post = await blogService.adminGetPost(req.params.id);
  if (!post) throw { statusCode: 404, message: 'Post not found.' };
  return successResponse(res, 200, 'Blog post', post);
});

const adminCreatePost = asyncHandler(async (req, res) => {
  const post = await blogService.adminCreatePost(req.body || {}, req.user);
  return successResponse(res, 201, 'Post created', post);
});

const adminUpdatePost = asyncHandler(async (req, res) => {
  const post = await blogService.adminUpdatePost(req.params.id, req.body || {});
  return successResponse(res, 200, 'Post updated', post);
});

const adminDeletePost = asyncHandler(async (req, res) => {
  const post = await blogService.adminDeletePost(req.params.id);
  if (!post) throw { statusCode: 404, message: 'Post not found.' };
  return successResponse(res, 200, 'Post deleted', post);
});

// POST /api/admin/blog/posts/ai-generate
// Runs the 4-step AI generation flow synchronously (research → pick →
// draft → image → persist as draft). Returns the created row so the
// admin UI can route the user straight to the editor.
const adminAiGeneratePost = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  try {
    const result = await aiBlogService.generateBlogPostDraft({
      authorUserId: adminId,
    });
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.blog_ai_generated',
      entity: 'blog_post',
      entityId: result.post.id,
      status: 'success',
      metadata: {
        slug: result.post.slug,
        topic: result.pick && result.pick.topic,
        elapsedSeconds: result.elapsedSeconds,
      },
    });
    return successResponse(res, 201, 'AI draft created', {
      post: result.post,
      pick: result.pick,
      image: result.image,
      elapsedSeconds: result.elapsedSeconds,
    });
  } catch (err) {
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.blog_ai_failed',
      entity: 'blog_post',
      status: 'failure',
      metadata: { message: err && err.message },
    });
    throw err;
  }
});

const adminListCategories = asyncHandler(async (req, res) => {
  const items = await blogService.listCategories();
  return successResponse(res, 200, 'Blog categories', { items });
});

const adminCreateCategory = asyncHandler(async (req, res) => {
  const cat = await blogService.createCategory(req.body || {});
  return successResponse(res, 201, 'Category created', cat);
});

const adminUpdateCategory = asyncHandler(async (req, res) => {
  const cat = await blogService.updateCategory(req.params.id, req.body || {});
  return successResponse(res, 200, 'Category updated', cat);
});

const adminDeleteCategory = asyncHandler(async (req, res) => {
  const cat = await blogService.deleteCategory(req.params.id);
  if (!cat) throw { statusCode: 404, message: 'Category not found.' };
  return successResponse(res, 200, 'Category deleted', cat);
});

const adminListTags = asyncHandler(async (req, res) => {
  const items = await blogService.listTags();
  return successResponse(res, 200, 'Blog tags', { items });
});

const adminCreateTag = asyncHandler(async (req, res) => {
  const tag = await blogService.createTag(req.body || {});
  return successResponse(res, 201, 'Tag created', tag);
});

const adminUpdateTag = asyncHandler(async (req, res) => {
  const tag = await blogService.updateTag(req.params.id, req.body || {});
  return successResponse(res, 200, 'Tag updated', tag);
});

const adminDeleteTag = asyncHandler(async (req, res) => {
  const tag = await blogService.deleteTag(req.params.id);
  if (!tag) throw { statusCode: 404, message: 'Tag not found.' };
  return successResponse(res, 200, 'Tag deleted', tag);
});

// --- Featured image upload (admin) ----------------------------------------

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// POST /api/admin/blog/images
// multipart with a single `file` field (uploadMiddleware.uploadSingle).
//
// When storage_driver=s3, the image lands under blog-images/ in the S3
// bucket and we return the public CDN URL.
// When storage_driver=local, we keep the legacy behaviour: write into
// env.blogImageDir so Next.js serves the file from /public/blog-images
// — important for SEO (image lives on the same origin as the post).
const adminUploadImage = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw { statusCode: 400, message: 'No file uploaded.' };
  if (!IMAGE_MIMES.has(file.mimetype)) {
    throw {
      statusCode: 415,
      message: 'Only JPG, PNG, WebP and GIF images are supported.',
    };
  }
  const driver = await storageService.getDriver();
  if (driver === 's3') {
    const persisted = await storageService.uploadFile({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      type: 'blog_image',
    });
    const url = await storageService.getFileUrl(persisted.storedPath);
    return successResponse(res, 201, 'Image uploaded', {
      url,
      fileName: persisted.storedName,
      key: persisted.key,
      size: persisted.size,
      mimeType: file.mimetype,
    });
  }
  // Local driver — keep the SEO-friendly behaviour of writing to the
  // Next.js public folder so /blog-images/* is served by the frontend.
  const ext = EXT_BY_MIME[file.mimetype] || 'bin';
  const stem = crypto.randomBytes(10).toString('hex');
  const fileName = `${Date.now()}-${stem}.${ext}`;
  const destDir = env.blogImageDir;
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, fileName);
  fs.writeFileSync(destPath, file.buffer);
  const url = `${env.blogImageUrlPrefix.replace(/\/$/, '')}/${fileName}`;
  return successResponse(res, 201, 'Image uploaded', {
    url,
    fileName,
    size: file.size,
    mimeType: file.mimetype,
  });
});

module.exports = {
  // Public
  listPosts,
  getPost,
  listCategories,
  listTags,
  // Admin
  adminListPosts,
  adminGetPost,
  adminCreatePost,
  adminUpdatePost,
  adminDeletePost,
  adminAiGeneratePost,
  adminListCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminListTags,
  adminCreateTag,
  adminUpdateTag,
  adminDeleteTag,
  adminUploadImage,
};
