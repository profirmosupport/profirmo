// Public read endpoints for the admin-managed taxonomy + city list. Every
// signup / profile / search dropdown in the frontend pulls from these two
// routes. No authentication is required.

const express = require('express');
const ctrl = require('../controllers/appSettingsController');

const router = express.Router();

router.get('/categories', ctrl.publicListCategories);
router.get('/cities', ctrl.publicListCities);
router.get('/locations', ctrl.publicListLocations);
router.get('/case-statuses', ctrl.publicListCaseStatuses);
router.get('/case-types', ctrl.publicListCaseTypes);
router.get('/cause-list-types', ctrl.publicListCauseListTypes);

module.exports = router;
