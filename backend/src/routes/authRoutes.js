const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validateRequest');

const router = express.Router();

router.post(
  '/login',
  validateBody({ email: 'required|email', password: 'required' }),
  authController.login
);

router.post(
  '/register-client',
  validateBody({
    name: 'required',
    email: 'required|email',
    password: 'required|min:6',
    phone: 'phone',
  }),
  authController.registerClient
);

router.post(
  '/register-professional',
  validateBody({
    name: 'required',
    email: 'required|email',
    password: 'required|min:6',
    professionType: 'required',
    city: 'required',
    phone: 'phone',
  }),
  authController.registerProfessional
);

router.post(
  '/register-firm',
  validateBody({
    name: 'required',
    email: 'required|email',
    password: 'required|min:6',
    firmType: 'required',
    city: 'required',
    phone: 'phone',
  }),
  authController.registerFirm
);

router.get('/me', authenticate, authController.getMe);

module.exports = router;
