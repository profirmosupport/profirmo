const express = require('express');
const caseController = require('../controllers/caseController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

// All case routes require an authenticated user. Specific endpoints scope
// what each role can read (mine / firm).
router.use(authenticate);

router.get('/', caseController.listCases);

// NOTE: literal sub-routes are declared before /:id so they are not shadowed.
router.get('/mine', caseController.getMyCases);
router.get('/mine-as-client', caseController.getMyClientCases);
router.get('/firm', caseController.getFirmCases);
router.get('/client/:clientId', caseController.getCasesByClient);
router.get(
  '/professional/:professionalId',
  caseController.getCasesByProfessional
);

router.post(
  '/',
  validateBody({
    clientId: 'required',
    title: 'required',
    category: 'required',
  }),
  caseController.createCase
);

router.get('/:id', caseController.getCase);
router.patch('/:id', caseController.updateCase);
router.delete('/:id', caseController.deleteCase);

// Notes + log.
router.get('/:id/notes', caseController.getCaseNotes);
router.post(
  '/:id/notes',
  validateBody({ body: 'required' }),
  caseController.addCaseNote
);
router.get('/:id/log', caseController.getCaseLog);

module.exports = router;
