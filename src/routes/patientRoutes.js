const express = require('express');
const router = express.Router();
const { 
  createPatient, 
  getPatients, 
  getPatientById, 
  addTreatment, 
  startTreatment // <--- Import it
} = require('../controllers/patientController');

router.route('/').get(getPatients).post(createPatient);
router.route('/:id').get(getPatientById);

// Treatment Routes
router.route('/:id/treatments').post(addTreatment);       // Add single item
router.route('/:id/treatments/start').post(startTreatment); // Approve all proposed

module.exports = router;