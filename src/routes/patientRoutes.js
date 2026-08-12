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
  updateSpecialtyDataKey,
  getCloudUploadUrl,
  saveAttachmentUrl,
  deleteCloudAttachment
} = require('../controllers/patientController');

const { scanIntakeForm } = require('../controllers/ocrController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Apply protection to all routes in this file
router.use(protect);

router.route('/').get(getPatients).post(createPatient);

router.route('/:id')
  .get(getPatientById)
  .delete(deletePatient)
  .put(updatePatient);

// Treatment Routes
router.route('/:id/treatments').post(addTreatment);       
router.route('/:id/treatments/start').post(startTreatment); 
router.route('/:id/treatments/:itemId')
  .patch(updateTreatmentStatus)  
  .delete(deleteTreatment);

router.post('/:id/upload', upload.single('file'), uploadAttachment);
router.delete('/:id/files', deleteAttachment);
router.put('/:id/treatments/bulk-complete', bulkCompleteTreatments);
router.put('/:id/tooth', updateSpecialtyDataKey);

// OCR Intake Scan
router.post('/scan', upload.single('formImage'), scanIntakeForm);

// Cloud Storage / CDN Routes (Ensure these exist in patientController.js!)
router.post('/:id/upload-url', getCloudUploadUrl);
router.post('/:id/save-attachment', saveAttachmentUrl);
router.delete('/:id/attachment', deleteCloudAttachment);

module.exports = router;