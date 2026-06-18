const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Import your authentication middleware
const { protect } = require('../middleware/authMiddleware'); 

// Apply protection to all WhatsApp integration routes
router.use(protect); 

// Matches the frontend call: api.post('/settings/whatsapp', ...)
router.post('/', whatsappController.saveConfig);

// Matches the frontend call: api.post('/settings/whatsapp/test', ...)
router.post('/test', whatsappController.testConnection);

module.exports = router;