const express = require('express');
const router = express.Router();
const {
  superAdminLogin,
  getDashboardData,
  updateClinicStatus,
  deleteClinic
} = require('../controllers/superAdminController');
const { protectSuperAdmin } = require('../middleware/superAdminMiddleware');

// Public Founder Endpoint
router.post('/login', superAdminLogin);

// All endpoints below require a valid Super Admin JWT
router.use(protectSuperAdmin);

router.get('/dashboard-data', getDashboardData);
router.put('/clinics/:id/status', updateClinicStatus);
router.delete('/clinics/:id', deleteClinic);

module.exports = router;