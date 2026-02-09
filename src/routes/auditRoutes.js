const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');

// 1. Import the middleware
const { protect, adminOnly } = require('../middleware/authMiddleware');

// 2. Apply it to the route
// The request goes:  User Request -> protect (Valid Token?) -> adminOnly (Is Admin?) -> Controller
router.get('/', protect, adminOnly, getAuditLogs);

module.exports = router;