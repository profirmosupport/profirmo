const express = require('express');
const reminderController = require('../controllers/reminderController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are owner-scoped — every reminder action runs as the calling
// professional, never cross-user. authenticate gates the entire router.
router.use(authenticate);

router.get('/', reminderController.list);
router.post('/', reminderController.create);
router.patch('/:id', reminderController.update);
router.delete('/:id', reminderController.remove);

module.exports = router;
