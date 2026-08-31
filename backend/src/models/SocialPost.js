// Sequelize model: SocialPost
//
// One row per generated daily social deck (Instagram carousel + YouTube
// community post). Stores the rendered card image URLs, the caption +
// hashtags, and — critically — a per-source-item `fingerprints` list so the
// same news item is never turned into a post twice. socialNewsService checks
// new candidate headlines against every stored fingerprint before rendering.
//
// kind:   'news'  → built from fresh RSS headlines
//         'knowledge' → evergreen "Legal Knowledge / Trusted Legal Guidance"
//                       explainer, used as a fallback when there isn't enough
//                       fresh, non-duplicate news for the day.
//
// status: 'draft'    → generated, awaiting admin approval (default)
//         'posted'   → pushed to Buffer (Instagram + YouTube)
//         'failed'   → Buffer rejected every channel
//         'archived' → dismissed by an admin without posting

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const genId = () => `social-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const SocialPost = sequelize.define(
  'SocialPost',
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
      defaultValue: genId,
    },
    // 'news' | 'knowledge'
    kind: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'news' },
    // 'hi' | 'en' — the deck language (currently Hindi).
    language: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'hi' },

    // Human-facing summary of the deck (admin list title).
    title: { type: DataTypes.STRING(255), allowNull: false },
    // The caption posted with the carousel (Hindi body + CTA).
    caption: { type: DataTypes.TEXT('long'), allowNull: true },

    // JSON string[] of hashtags (without the leading #).
    hashtags: jsonArray('hashtags'),
    // JSON string[] of public S3 image URLs, slide order (cover → cta).
    imageUrls: jsonArray('imageUrls'),
    // JSON of the structured deck we rendered from (cover/cards/cta) — kept so
    // an admin can see exactly what was drawn and we can re-render if needed.
    deck: jsonField('deck'),
    // JSON string[] of source item fingerprints included in this post. Used by
    // the dedup check to guarantee no headline is ever reshared.
    fingerprints: jsonArray('fingerprints'),
    // JSON of source items [{ title, link, source }] for reference.
    sources: jsonField('sources'),

    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'draft',
    },
    // Buffer result: JSON { instagram: {...}, youtube: {...}, failures: [] }
    postResult: jsonField('postResult'),
    postedAt: { type: DataTypes.DATE, allowNull: true },
    lastError: { type: DataTypes.STRING(1000), allowNull: true },
  },
  {
    tableName: 'social_posts',
    timestamps: true,
    indexes: [{ fields: ['status'] }, { fields: ['createdAt'] }],
  }
);

// LONGTEXT-backed JSON array field with a tolerant getter (mirrors the
// BlogPost.tagIds pattern — DataTypes.JSON over a TEXT column stringifies on
// write but doesn't auto-parse on read).
function jsonArray(field) {
  return {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const raw = this.getDataValue(field);
      if (raw == null) return [];
      if (Array.isArray(raw)) return raw;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
  };
}

function jsonField(field) {
  return {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const raw = this.getDataValue(field);
      if (raw == null) return null;
      if (typeof raw === 'object') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
  };
}

module.exports = SocialPost;
