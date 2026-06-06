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
  // Accept either a single `clientId` or a multi-client `clientIds[]` array.
  // The service normalises both into the same shape.
  validateBody({
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
router.patch(
  '/:id/notes/:noteId',
  validateBody({ body: 'required' }),
  caseController.editCaseNote
);
router.delete('/:id/notes/:noteId', caseController.deleteCaseNote);
router.get('/:id/log', caseController.getCaseLog);

// Auth-gated attachment URL resolver. The browser/mobile never holds
// an S3 URL directly — it asks the backend, the backend verifies the
// caller can access the case + that the key belongs to this case, then
// returns a short-lived presigned URL. A leaked storage key is useless
// without an auth-bearing request to this endpoint.
router.get('/:id/attachments/url', caseController.getAttachmentUrl);
// Body proxy — every request goes through the auth gate, so a leaked
// URL is useless on its own. Preferred for new code; the /url variant
// stays for back-compat callers that want a direct S3 presigned URL.
router.get('/:id/attachments/stream', caseController.streamAttachment);

// Updates — a richer note with date/time, optional next-hearing date, and
// attachments. Only the body is required; the rest are optional.
router.get('/:id/updates', caseController.listCaseUpdates);
router.post(
  '/:id/updates',
  validateBody({ body: 'required' }),
  caseController.addCaseUpdate
);
router.patch('/:id/updates/:updateId', caseController.editCaseUpdate);
router.delete('/:id/updates/:updateId', caseController.deleteCaseUpdate);

// E-Courts India sync — re-pull the latest case detail from the partner
// API and overwrite the local snapshot. Returns a structured diff so the
// UI can show "what changed since last viewed" in a modal.
const ecourtsController = require('../controllers/ecourtsController');
router.post('/:id/sync-ecourts', ecourtsController.syncCase);

module.exports = router;
