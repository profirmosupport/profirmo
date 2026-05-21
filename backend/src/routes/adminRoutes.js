const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// All admin routes require an authenticated platform_admin.
router.use(authenticate, authorize('platform_admin'));

router.get('/stats', adminController.getStats);
router.get('/users', adminController.listUsers);
router.get('/professionals/pending', adminController.getPendingProfessionals);
router.patch(
  '/professionals/:id/approve',
  adminController.approveProfessional
);
router.get('/firms', adminController.listFirms);
router.get('/bookings', adminController.listBookings);

module.exports = router;
