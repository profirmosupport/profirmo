const express = require('express');
const caseController = require('../controllers/caseController');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

router.get('/', caseController.listCases);

// NOTE: /client and /professional sub-routes are declared before /:id
// so they are not shadowed by the id parameter route.
router.get('/client/:clientId', caseController.getCasesByClient);
router.get(
  '/professional/:professionalId',
  caseController.getCasesByProfessional
);

router.post(
  '/',
  validateBody({
    clientId: 'required',
    professionalId: 'required',
    title: 'required',
    category: 'required',
  }),
  caseController.createCase
);

router.get('/:id', caseController.getCase);
router.patch('/:id', caseController.updateCase);
router.delete('/:id', caseController.deleteCase);

module.exports = router;
