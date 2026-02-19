const express = require('express');
const router = express.Router();
const { 
  getDrugs, 
  createPrescription, 
  getPatientPrescriptions, 
  deletePrescription,
  updatePrescription
} = require('../controllers/prescriptionController');

const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/drugs', getDrugs); 
router.post('/', createPrescription);
router.get('/patient/:patientId', getPatientPrescriptions);

router.delete('/:id', deletePrescription);
router.put('/:id', updatePrescription);

module.exports = router;