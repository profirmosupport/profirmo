// ecourtsRoutes — public catalog access to ecourtsindia.com via the
// backend proxy. Mount at /api/ecourts in app.js.

const express = require('express');
const ecourtsController = require('../controllers/ecourtsController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Search is intentionally public — anyone can search the catalog. Detail
// requires sign-in (the request from the browser carries the token; the
// page also gates render-side).
router.get('/search', ecourtsController.search);
router.get('/case/:cnr', authenticate, ecourtsController.getCase);
router.get(
  '/case/:cnr/order/:filename/download',
  authenticate,
  ecourtsController.downloadOrder
);
router.get(
  '/case/:cnr/order/:filename/ai',
  authenticate,
  ecourtsController.getOrderAi
);

// Refresh-as-add — used when a CNR-shaped search returns 0 hits in the
// partner index. Auth-gated because the underlying POST /refresh is
// credit-billed upstream.
router.post(
  '/refresh-as-add',
  authenticate,
  ecourtsController.refreshAsAdd
);

// --- Free taxonomy + lookup (no upstream credit cost) ------------------
router.get('/enums', ecourtsController.getEnums);
router.get('/court-structure/states', ecourtsController.getStates);
router.get(
  '/court-structure/states/:state/districts',
  ecourtsController.getDistricts
);
router.get(
  '/court-structure/states/:state/districts/:districtCode/complexes',
  ecourtsController.getComplexes
);
router.get(
  '/court-structure/states/:state/districts/:districtCode/complexes/:complexCode/courts',
  ecourtsController.getCourts
);

// --- Causelist (credit-billed; auth-gated) ------------------------------
router.get(
  '/causelist/available-dates',
  authenticate,
  ecourtsController.causelistAvailableDates
);
router.get(
  '/causelist/search',
  authenticate,
  ecourtsController.causelistSearch
);

// --- Persistence: favourites + import into Cases module (auth-gated) ---
router.get('/favorites', authenticate, ecourtsController.listFavorites);
router.post('/favorites', authenticate, ecourtsController.addFavorite);
router.delete('/favorites/:cnr', authenticate, ecourtsController.removeFavorite);
router.get(
  '/cases/imported/:cnr',
  authenticate,
  ecourtsController.getImportedCase
);
router.post('/cases/import', authenticate, ecourtsController.importCase);

module.exports = router;
