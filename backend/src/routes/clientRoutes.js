const express = require('express');
const clientController = require('../controllers/clientController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

// Client management is professional-facing and always requires auth.
router.use(authenticate);

router.get('/', clientController.listClients);
// /search-by-phone must come before /:id so it is not shadowed.
router.get('/search-by-phone', clientController.searchByPhone);
router.get('/:id', clientController.getClient);

router.post(
  '/',
  validateBody({}),
  clientController.createClient
);

router.post('/:id/link', clientController.linkClient);
router.patch('/:id', clientController.updateClient);

module.exports = router;
