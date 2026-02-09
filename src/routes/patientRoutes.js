const express = require('express');
const router = express.Router();
const { 
  createPatient, 
  getPatients, 
  getPatientById, 
  addTreatment, 
  startTreatment // <--- Import it
} = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware'); // <--- Import Guard

// Apply protection to all routes in this file
router.use(protect);
router.route('/').get(getPatients).post(createPatient);
router.route('/:id').get(getPatientById);

// Treatment Routes
router.route('/:id/treatments').post(addTreatment);       // Add single item
router.route('/:id/treatments/start').post(startTreatment); // Approve all proposed

module.exports = router;