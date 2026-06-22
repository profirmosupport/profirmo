// userPreferenceService — read/write small per-user UI prefs.
//
// API surface:
//   getOne(userId, key)        -> value | null
//   getAll(userId)             -> { [key]: value }
//   setOne(userId, key, value) -> { key, value }
//
// `value` is JSON; pass anything serializable. NULL or undefined
// effectively deletes the pref.

const { UserPreference } = require('../models');

async function getOne(userId, key) {
  if (!userId || !key) return null;
  const row = await UserPreference.findOne({
    where: { userId, key },
    raw: true,
  });
  return row ? row.value : null;
}

async function getAll(userId) {
  if (!userId) return {};
  const rows = await UserPreference.findAll({
    where: { userId },
    raw: true,
  });
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

async function setOne(userId, key, value) {
  if (!userId || !key) {
    throw { statusCode: 422, message: 'userId + key required' };
  }
  if (value === null || value === undefined) {
    await UserPreference.destroy({ where: { userId, key } });
    return { key, value: null };
  }
  const existing = await UserPreference.findOne({ where: { userId, key } });
  if (existing) {
    await existing.update({ value });
    return { key, value };
  }
  await UserPreference.create({ userId, key, value });
  return { key, value };
}

module.exports = { getOne, getAll, setOne };
