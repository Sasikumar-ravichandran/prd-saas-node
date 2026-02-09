const express = require('express');
const router = express.Router();
const { getRoleConfig, updateRoleConfig } = require('../controllers/roleController');
const { getClinicProfile, updateClinicProfile } = require('../controllers/clinicController');

// Role Configuration Routes
router.get('/roles', getRoleConfig);
router.put('/roles', updateRoleConfig);

router.get('/clinic', getClinicProfile);
router.put('/clinic', updateClinicProfile);

module.exports = router;