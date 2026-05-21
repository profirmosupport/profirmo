const express = require('express');
const clientController = require('../controllers/clientController');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

router.get('/', clientController.listClients);
router.get('/:id', clientController.getClient);

router.post(
  '/',
  validateBody({
    name: 'required',
    email: 'required|email',
    phone: 'phone',
  }),
  clientController.createClient
);

router.patch('/:id', clientController.updateClient);

module.exports = router;
