const express = require('express');
const adminController = require('../controllers/adminController');
const appSettings = require('../controllers/appSettingsController');
const leads = require('../controllers/leadController');
const adminPayments = require('../controllers/adminPaymentsController');
const payoutController = require('../controllers/payoutController');
const adminSettings = require('../controllers/adminSettingsController');
const blog = require('../controllers/blogController');
const subscription = require('../controllers/subscriptionController');
const { uploadSingle, handleUploadErrors } = require('../middleware/uploadMiddleware');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// All admin routes require an authenticated platform_admin.
router.use(authenticate, authorize('platform_admin'));

router.get('/stats', adminController.getStats);
router.get('/overview', adminController.getOverview);
router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.get('/users/:id', adminController.getUser);
router.get('/users/:id/transactions', adminController.getUserTransactions);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/status', adminController.updateUserStatus);
// Admin-only manual subscription grant. Bypasses Razorpay; the body
// picks a plan and an end date and the service records an active row.
router.post(
  '/users/:id/subscription',
  subscription.adminActivateSubscription
);

// --- Phase 7: professional approval workflow ------------------------------
// /pending and the legacy-Professional approve route are declared BEFORE the
// /:approvalId param route so they are not shadowed by it.
router.get(
  '/professionals/pending',
  adminController.listPendingApprovals
);
// Legacy Professional-table approval (kept for back-compat).
router.patch(
  '/professionals/:id/approve',
  adminController.approveProfessional
);
router.post(
  '/professionals/:approvalId/approve',
  adminController.approveProfessionalApplication
);
router.post(
  '/professionals/:approvalId/reject',
  adminController.rejectProfessionalApplication
);
router.post(
  '/professionals/:approvalId/request-info',
  adminController.requestProfessionalInfo
);
router.get(
  '/professionals/:approvalId',
  adminController.getProfessionalApproval
);

// --- Phase 8: firm approval workflow --------------------------------------
// /firms/pending is declared BEFORE /firms/:approvalId so it is not shadowed
// by the param route. The legacy GET /firms (Firm table) is kept untouched.
router.get('/firms/pending', adminController.listPendingFirms);
router.get('/firms', adminController.listFirms);
router.post(
  '/firms/:approvalId/approve',
  adminController.approveFirmApplication
);
router.post(
  '/firms/:approvalId/reject',
  adminController.rejectFirmApplication
);
router.post(
  '/firms/:approvalId/request-modifications',
  adminController.requestFirmModifications
);
router.get('/firms/:approvalId', adminController.getFirmApproval);

router.get('/bookings', adminController.listBookings);
router.get('/audit-logs', adminController.listAuditLogs);

// --- Firm CRUD (operates on law_firms — separate from approval workflow) --
router.get('/law-firms', adminController.listLawFirms);
router.post('/law-firms', adminController.createLawFirm);
router.get('/law-firms/:id', adminController.getLawFirmDetail);
router.patch('/law-firms/:id', adminController.updateLawFirm);
router.delete('/law-firms/:id', adminController.deleteLawFirm);

// --- Reviews & review appeals ---------------------------------------------
// Only an admin can change or delete reviews, and resolve appeals.
router.get('/reviews', adminController.listReviews);
router.patch('/reviews/:id', adminController.updateReview);
router.delete('/reviews/:id', adminController.deleteReview);
router.get('/review-appeals', adminController.listReviewAppeals);
router.post(
  '/review-appeals/:id/resolve',
  adminController.resolveReviewAppeal
);

// --- App settings: categories + sub-categories + cities -------------------
router.get('/categories', appSettings.adminListCategories);
router.post('/categories', appSettings.adminCreateCategory);
router.patch('/categories/:id', appSettings.adminUpdateCategory);
router.delete('/categories/:id', appSettings.adminDeleteCategory);

router.post('/sub-categories', appSettings.adminCreateSubCategory);
router.patch('/sub-categories/:id', appSettings.adminUpdateSubCategory);
router.delete('/sub-categories/:id', appSettings.adminDeleteSubCategory);

router.get('/cities', appSettings.adminListCities);
router.post('/cities', appSettings.adminCreateCity);
router.patch('/cities/:id', appSettings.adminUpdateCity);
router.delete('/cities/:id', appSettings.adminDeleteCity);

// --- Locations hierarchy (Country -> State -> City) -------------------
router.get('/locations', appSettings.adminListLocations);
router.post('/countries', appSettings.adminCreateCountry);
router.patch('/countries/:id', appSettings.adminUpdateCountry);
router.delete('/countries/:id', appSettings.adminDeleteCountry);
router.post('/states', appSettings.adminCreateState);
router.patch('/states/:id', appSettings.adminUpdateState);
router.delete('/states/:id', appSettings.adminDeleteState);
// Hierarchical city writes (stateId required). The flat /cities CRUD
// above stays for back-compat with the legacy admin cities page.
router.post('/locations/cities', appSettings.adminCreateCityForState);
router.patch('/locations/cities/:id', appSettings.adminUpdateCityHierarchical);

// --- Case statuses (admin-managed enum) ---------------------------------
router.get('/case-statuses', appSettings.adminListCaseStatuses);
router.post('/case-statuses', appSettings.adminCreateCaseStatus);
router.patch('/case-statuses/:id', appSettings.adminUpdateCaseStatus);
router.delete('/case-statuses/:id', appSettings.adminDeleteCaseStatus);

// --- Case types (admin-managed enum) ------------------------------------
router.get('/case-types', appSettings.adminListCaseTypes);
router.post('/case-types', appSettings.adminCreateCaseType);
router.patch('/case-types/:id', appSettings.adminUpdateCaseType);
router.delete('/case-types/:id', appSettings.adminDeleteCaseType);

// --- Cause list types (admin-managed enum) ------------------------------
router.get('/cause-list-types', appSettings.adminListCauseListTypes);
router.post('/cause-list-types', appSettings.adminCreateCauseListType);
router.patch('/cause-list-types/:id', appSettings.adminUpdateCauseListType);
router.delete('/cause-list-types/:id', appSettings.adminDeleteCauseListType);

// --- Leads pipeline -------------------------------------------------------
router.get('/leads', leads.adminListLeads);
router.post('/leads', leads.adminCreateLead);
router.get('/leads/:id', leads.adminGetLead);
router.patch('/leads/:id', leads.adminUpdateLead);
router.delete('/leads/:id', leads.adminDeleteLead);
router.get('/leads/:id/activities', leads.adminListLeadActivities);
router.post('/leads/:id/notes', leads.adminAddLeadNote);
router.post('/leads/:id/convert', leads.adminConvertLead);

// --- Opportunities pipeline ----------------------------------------------
router.get('/opportunities', leads.adminListOpportunities);
router.get('/opportunities/:id', leads.adminGetOpportunity);
router.patch('/opportunities/:id', leads.adminUpdateOpportunity);
router.delete('/opportunities/:id', leads.adminDeleteOpportunity);
router.get(
  '/opportunities/:id/activities',
  leads.adminListOpportunityActivities
);
router.post('/opportunities/:id/notes', leads.adminAddOpportunityNote);
router.post('/opportunities/:id/convert', leads.adminConvertOpportunity);

// --- Payments (Razorpay + escrow) ----------------------------------------
router.get('/payments', adminPayments.list);
router.post('/payments/:id/refund', adminPayments.refund);

// --- Platform settings (markup %, etc.) ---------------------------------
router.get('/settings', adminSettings.list);
router.patch('/settings/:key', adminSettings.update);
// One-click connectivity test for AWS S3 — puts + deletes a small file
// in temp/ to verify credentials and bucket permissions.
router.post('/settings/storage/test', adminSettings.testStorage);

// --- Payouts -------------------------------------------------------------
router.get('/payouts', payoutController.adminList);
router.get('/payouts/:id', payoutController.adminGet);
router.post('/payouts/:id/approve', payoutController.adminApprove);
router.post('/payouts/:id/reject', payoutController.adminReject);
router.post('/payouts/:id/paid', payoutController.adminMarkPaid);

// --- Blog management -----------------------------------------------------
// Posts
router.get('/blog/posts', blog.adminListPosts);
router.post('/blog/posts', blog.adminCreatePost);
router.get('/blog/posts/:id', blog.adminGetPost);
router.patch('/blog/posts/:id', blog.adminUpdatePost);
router.delete('/blog/posts/:id', blog.adminDeletePost);
// Categories
router.get('/blog/categories', blog.adminListCategories);
router.post('/blog/categories', blog.adminCreateCategory);
router.patch('/blog/categories/:id', blog.adminUpdateCategory);
router.delete('/blog/categories/:id', blog.adminDeleteCategory);
// Tags
router.get('/blog/tags', blog.adminListTags);
router.post('/blog/tags', blog.adminCreateTag);
router.patch('/blog/tags/:id', blog.adminUpdateTag);
router.delete('/blog/tags/:id', blog.adminDeleteTag);
// Featured-image upload — writes to frontend/public/blog-images so Next.js
// serves the file as a first-class static asset (same origin as the page).
router.post(
  '/blog/images',
  uploadSingle,
  handleUploadErrors,
  blog.adminUploadImage
);

// --- Subscription management --------------------------------------------
// CRUD over subscription plans + feature rules. /feature-keys must come
// BEFORE /:id so the static route isn't shadowed by the param route.
router.get('/subscription-plans/feature-keys', subscription.adminFeatureKeys);
router.get('/subscription-plans', subscription.adminList);
router.post('/subscription-plans', subscription.adminCreate);
router.get('/subscription-plans/:id', subscription.adminGet);
router.patch('/subscription-plans/:id', subscription.adminUpdate);
router.delete('/subscription-plans/:id', subscription.adminDelete);
router.patch('/subscription-plans/:id/status', subscription.adminSetStatus);
router.post('/subscription-plans/:id/duplicate', subscription.adminDuplicate);
router.get(
  '/subscription-plans/:id/subscribers',
  subscription.adminListSubscribers
);

module.exports = router;
