const express = require('express');
const adminController = require('../controllers/adminController');
const appSettings = require('../controllers/appSettingsController');
const leads = require('../controllers/leadController');
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
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/status', adminController.updateUserStatus);

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

module.exports = router;
