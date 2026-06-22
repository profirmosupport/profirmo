const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');
const prefs = require('../services/userPreferenceService');

const getAll = asyncHandler(async (req, res) => {
  const out = await prefs.getAll(req.user.id);
  return successResponse(res, 200, 'User prefs', out);
});

const getOne = asyncHandler(async (req, res) => {
  const out = await prefs.getOne(req.user.id, req.params.key);
  return successResponse(res, 200, 'User pref', { key: req.params.key, value: out });
});

const setOne = asyncHandler(async (req, res) => {
  const out = await prefs.setOne(
    req.user.id,
    req.params.key,
    req.body && Object.prototype.hasOwnProperty.call(req.body, 'value')
      ? req.body.value
      : null
  );
  return successResponse(res, 200, 'User pref saved', out);
});

module.exports = { getAll, getOne, setOne };
