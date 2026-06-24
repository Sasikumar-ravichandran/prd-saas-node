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
  uploadAttachment,
  deleteAttachment,
  bulkCompleteTreatments,
  updateToothCondition
} = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware');
const { scanIntakeForm } = require('../controllers/ocrController')
const upload = require('../middleware/uploadMiddleware');

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
router.post('/:id/upload', upload.single('file'), uploadAttachment);
router.delete('/:id/files', deleteAttachment);
router.put('/:id/treatments/bulk-complete', bulkCompleteTreatments);
router.put('/:id/tooth', updateToothCondition);
// routes/patientRoutes.js
router.post('/scan', protect, upload.single('formImage'), scanIntakeForm);

module.exports = router;