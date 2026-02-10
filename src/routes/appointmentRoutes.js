const express = require('express');
const router = express.Router();
const { 
  getAppointments, 
  createAppointment, 
  updateAppointment, 
  deleteAppointment 
} = require('../controllers/appointmentController');
const { protect } = require('../middleware/authMiddleware');

// Protect all routes
router.use(protect);

router.get('/', getAppointments);
router.post('/', createAppointment);
router.put('/:id', updateAppointment);
router.delete('/:id', deleteAppointment);

module.exports = router;