const profileService = require('../services/profileService');
const permissionService = require('../services/permissionService');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/responseHandler');

// GET /api/profile — the current user's complete profile + RBAC summary.
const getProfile = asyncHandler(async (req, res) => {
  const [profile, permissions] = await Promise.all([
    profileService.getCompleteProfile(req.user.id),
    permissionService.describeForUser(req.user),
  ]);
  // Attach a `permissions` block alongside the existing profile so the
  // UI can hide / disable controls based on the user's firm role.
  // Shape: { role, actions: [...], admin: bool, solo: bool, legacyRole }
  const payload = profile && typeof profile === 'object'
    ? { ...profile, permissions }
    : { permissions };
  return successResponse(res, 200, 'Profile fetched', payload);
});

// PUT /api/profile — update personal info + address.
const updateProfile = asyncHandler(async (req, res) => {
  const profile = await profileService.updateProfile(
    req.user.id,
    req.body
  );
  return successResponse(res, 200, 'Profile updated', profile);
});

// PUT /api/profile/professional — upsert professional details.
const updateProfessionalProfile = asyncHandler(async (req, res) => {
  const profile = await profileService.updateProfessionalProfile(
    req.user.id,
    req.body
  );
  return successResponse(
    res,
    200,
    'Professional profile updated',
    profile
  );
});

module.exports = {
  getProfile,
  updateProfile,
  updateProfessionalProfile,
};
