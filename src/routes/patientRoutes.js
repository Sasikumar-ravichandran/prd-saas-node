const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure Multer to keep files temporarily in RAM
const upload = multer({ storage: multer.memoryStorage() });

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
  deleteCloudAttachment,
  uploadPatientFile
} = require('../controllers/patientController');

const { scanIntakeForm } = require('../controllers/ocrController');
const { protect } = require('../middleware/authMiddleware');

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

// Cloud Storage / CDN Routes
router.post('/:id/upload-url', getCloudUploadUrl);
router.post('/:id/save-attachment', saveAttachmentUrl);
router.delete('/:id/attachment', deleteCloudAttachment);

//NEW: Bulletproof backend-routed file upload (Bypasses browser CORS/ERR_CONNECTION_RESET)
router.post('/:id/upload-file', upload.single('file'), uploadPatientFile);

module.exports = router;