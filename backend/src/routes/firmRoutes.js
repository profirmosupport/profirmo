const express = require('express');
const firmController = require('../controllers/firmController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

router.get('/', firmController.listFirms);
router.get('/:id', firmController.getFirm);
router.get('/:id/professionals', firmController.getFirmProfessionals);

// Protected: only a firm admin can add professionals to a firm.
router.post(
  '/:id/professionals',
  authenticate,
  authorize('firm_admin'),
  validateBody({
    name: 'required',
    email: 'required|email',
    professionType: 'required',
  }),
  firmController.addFirmProfessional
);

router.get('/:id/clients', firmController.getFirmClients);
router.get('/:id/cases', firmController.getFirmCases);

module.exports = router;
