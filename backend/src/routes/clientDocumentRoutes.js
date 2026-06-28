// Routes for the per-client document store + access permissions.
// Mounted at /api/client-documents in app.js.

const express = require('express');
const ctrl = require('../controllers/clientDocumentController');
const { authenticate } = require('../middleware/authMiddleware');
const {
  uploadSingle,
  handleUploadErrors,
} = require('../middleware/uploadMiddleware');

const router = express.Router();
router.use(authenticate);

// --- Per-client document operations --------------------------------
router.get('/by-client/:clientUserId', ctrl.list);
router.post(
  '/by-client/:clientUserId/upload',
  uploadSingle,
  handleUploadErrors,
  ctrl.upload
);
router.get('/:id/url', ctrl.getUrl);
router.delete('/:id', ctrl.remove);

// --- Access requests + decisions ----------------------------------
router.post('/access/by-client/:clientUserId/request', ctrl.requestAccess);
router.get('/access/by-client/:clientUserId', ctrl.getProAccessForClient);
router.patch('/access/:id', ctrl.decideAccess);
router.get('/access/mine/pro', ctrl.listAccessForPro);
router.get('/access/mine/client', ctrl.listAccessForClient);

module.exports = router;
