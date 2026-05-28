const express = require('express');
const lawFirmController = require('../controllers/lawFirmController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// All law-firm routes require an authenticated user. Firm-role permissions
// (owner / co-owner / member) are enforced in the service layer, since they
// depend on the caller's relationship to a firm rather than their JWT role.
router.use(authenticate);

// Read the caller's firm + members + role + approval status.
router.get('/mine', lawFirmController.getMyFirm);
router.get('/mine/members', lawFirmController.getMembers);
router.get('/mine/clients', lawFirmController.getFirmClients);
router.get('/mine/leads', lawFirmController.getMyFirmLeads);
router.post(
  '/mine/leads/:leadId/add-client',
  lawFirmController.addLeadAsClient
);

// Search approved professionals to invite (declared before /mine paths is
// not required, but kept near the read routes for clarity).
router.get(
  '/search-professionals',
  lawFirmController.searchProfessionals
);

// Create / update the caller's firm. Creation is gated on the caller being an
// approved professional; editing is owner-only (both checked in the service).
router.post('/', lawFirmController.createFirm);
router.put('/mine', lawFirmController.updateFirm);

// --- Firm-side invitations (owner / co-owner) -----------------------------
router.post('/mine/invitations', lawFirmController.createInvitation);
router.get('/mine/invitations', lawFirmController.listFirmInvitations);
router.delete(
  '/mine/invitations/:id',
  lawFirmController.cancelInvitation
);

// --- Member management ----------------------------------------------------
// Direct add-by-email is superseded by invitations (returns 410 Gone).
router.post('/mine/members', lawFirmController.addMember);
// Change a member's role — owner only (enforced in the service).
router.patch(
  '/mine/members/:memberId/role',
  lawFirmController.changeMemberRole
);
// Remove a member — owner or co-owner (enforced in the service).
router.delete(
  '/mine/members/:memberId',
  lawFirmController.removeMember
);

module.exports = router;
