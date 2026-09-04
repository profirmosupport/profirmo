// socialController — admin CRUD + actions for the daily Instagram + YouTube
// news carousel ("Insta & YouTube posts" under Admin → Posts).
//
//   GET    /api/admin/social/posts            list decks (newest first)
//   GET    /api/admin/social/posts/:id        one deck
//   POST   /api/admin/social/posts/generate   build today's deck now (draft)
//   POST   /api/admin/social/posts/:id/post   push a draft to Buffer
//   DELETE /api/admin/social/posts/:id         archive/delete a deck

const https = require('https');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, paginatedResponse } = require('../utils/responseHandler');
const socialNewsService = require('../services/socialNewsService');
const bufferService = require('../services/bufferService');
const adminSettings = require('../services/adminSettingsService');
const { logAudit } = require('../utils/auditLogger');
const { SocialPost } = require('../models');

// GET /api/admin/social/status — is the social Buffer account connected, and
// what are the current auto-post / per-day settings? Drives the admin banner.
const adminStatus = asyncHandler(async (req, res) => {
  const [bufferConfigured, autoPost, perDay] = await Promise.all([
    bufferService.isSocialConfigured().catch(() => false),
    adminSettings.getString('social_auto_post').catch(() => 'false'),
    adminSettings.getNumber('social_posts_per_day').catch(() => 3),
  ]);
  return successResponse(res, 200, 'Social status', {
    bufferConfigured,
    autoPost: String(autoPost).toLowerCase() === 'true',
    perDay: Number(perDay) || 3,
  });
});

// GET /api/admin/social/posts?page=&limit=&status=
const adminListPosts = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const where = {};
  if (req.query.status) where.status = String(req.query.status);
  const { rows, count } = await SocialPost.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * limit,
    limit,
  });
  return paginatedResponse(
    res,
    'Social posts',
    rows.map((r) => r.get({ plain: true })),
    { page, limit, total: count }
  );
});

// GET /api/admin/social/posts/:id
const adminGetPost = asyncHandler(async (req, res) => {
  const row = await SocialPost.findByPk(req.params.id);
  if (!row) throw { statusCode: 404, message: 'Social post not found.' };
  return successResponse(res, 200, 'Social post', row.get({ plain: true }));
});

// POST /api/admin/social/posts/generate  { autoPost? }
// Builds today's deck synchronously and returns it. Always saves a draft;
// posts immediately only when body.autoPost === true.
const adminGeneratePost = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  const autoPost = req.body && req.body.autoPost === true ? true : null;
  try {
    const row = await socialNewsService.generateDailyPost({ autoPost });
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.social_generated',
      entity: 'social_post',
      entityId: row.id,
      status: 'success',
      metadata: { kind: row.kind, images: (row.imageUrls || []).length, status: row.status },
    });
    return successResponse(res, 201, 'Social deck generated', row.get({ plain: true }));
  } catch (err) {
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.social_generate_failed',
      entity: 'social_post',
      status: 'failure',
      metadata: { message: err && err.message },
    });
    throw err;
  }
});

// POST /api/admin/social/posts/:id/post — approve + push a draft to Buffer.
const adminPostNow = asyncHandler(async (req, res) => {
  const adminId = req.user && req.user.id;
  try {
    const row = await socialNewsService.postDraft(req.params.id);
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.social_posted',
      entity: 'social_post',
      entityId: req.params.id,
      status: row.status === 'posted' ? 'success' : 'failure',
      metadata: { status: row.status, result: row.postResult },
    });
    return successResponse(res, 200, 'Social post pushed to Buffer', row.get({ plain: true }));
  } catch (err) {
    await logAudit({
      req,
      userId: adminId,
      action: 'admin.social_post_failed',
      entity: 'social_post',
      entityId: req.params.id,
      status: 'failure',
      metadata: { message: err && err.message },
    });
    throw err;
  }
});

// GET /api/admin/social/posts/:id/image/:index — stream one slide back with a
// proper filename + Content-Disposition so the admin UI can force a real
// download (the raw S3 URL just opens in a tab). Auth-gated by the admin router.
const adminDownloadImage = asyncHandler(async (req, res) => {
  const row = await SocialPost.findByPk(req.params.id);
  if (!row) throw { statusCode: 404, message: 'Social post not found.' };
  const urls = row.imageUrls || [];
  const idx = parseInt(req.params.index, 10);
  const url = urls[idx];
  if (!url) throw { statusCode: 404, message: 'Image not found.' };
  const date = new Date(row.createdAt).toISOString().slice(0, 10);
  const filename = `profirmo-${row.kind || 'news'}-${date}-slide-${idx + 1}.png`;
  await new Promise((resolve) => {
    https
      .get(url, (upstream) => {
        if (upstream.statusCode !== 200) {
          upstream.resume();
          res.status(502).json({ success: false, message: `Upstream ${upstream.statusCode}` });
          return resolve();
        }
        res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length']);
        upstream.pipe(res);
        upstream.on('end', resolve);
      })
      .on('error', (err) => {
        if (!res.headersSent) res.status(502).json({ success: false, message: err.message });
        resolve();
      });
  });
});

// DELETE /api/admin/social/posts/:id — hard delete a draft/failed deck.
const adminDeletePost = asyncHandler(async (req, res) => {
  const row = await SocialPost.findByPk(req.params.id);
  if (!row) throw { statusCode: 404, message: 'Social post not found.' };
  await row.destroy();
  await logAudit({
    req,
    userId: req.user && req.user.id,
    action: 'admin.social_deleted',
    entity: 'social_post',
    entityId: req.params.id,
    status: 'success',
  });
  return successResponse(res, 200, 'Social post deleted', { id: req.params.id });
});

module.exports = {
  adminStatus,
  adminListPosts,
  adminGetPost,
  adminGeneratePost,
  adminPostNow,
  adminDownloadImage,
  adminDeletePost,
};
