const express = require('express');
const router = express.Router();
const { getRoleConfig, updateRoleConfig } = require('../controllers/roleController');
const { getClinicProfile, updateClinicProfile } = require('../controllers/clinicController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ==========================================
// CLINIC PROFILE ROUTES
// ==========================================

// GET: Any staff can view the clinic profile
router.get('/clinic', protect, getClinicProfile);

// PUT: Only Admins can update the clinic profile
router.put('/clinic', protect, adminOnly, updateClinicProfile);


// ==========================================
// ROLE CONFIGURATION ROUTES
// ==========================================

// GET: Any staff (or just admin) can view roles
// (Must have 'protect' so req.user exists!)
router.get('/roles', protect, getRoleConfig);

// PUT: Only Admins can change permissions
// (You previously had 'updateClinicProfile' here by mistake)
router.put('/roles', protect, adminOnly, updateRoleConfig);

module.exports = router;