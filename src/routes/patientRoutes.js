const express = require('express');
const router = express.Router();
const {
  createPatient,
  getPatients,
  getPatientById,
  deletePatient,
  addTreatment,
  startTreatment,
  deleteTreatment,
  updateTreatmentStatus,
  updatePatient,
} = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware'); // <--- Import Guard

// Apply protection to all routes in this file
router.use(protect);
router.route('/').get(getPatients).post(createPatient);
router.route('/:id')
  .get(getPatientById)
  .delete(deletePatient)
  .put(updatePatient);

// Treatment Routes
router.route('/:id/treatments').post(addTreatment);       // Add single item
router.route('/:id/treatments/start').post(startTreatment); // Approve all proposed
router.route('/:id/treatments/:itemId')
  .patch(updateTreatmentStatus)  // Update Status (Revert/Complete)
  .delete(deleteTreatment);


module.exports = router;