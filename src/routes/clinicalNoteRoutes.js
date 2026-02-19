const express = require('express');
const router = express.Router();
const { 
  getNotes, 
  createNote, 
  updateMedicalAlerts,
  deleteNote 
} = require('../controllers/clinicalNoteController');

const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/:patientId', getNotes);         // Fetch timeline
router.post('/', createNote);                // Add note
router.put('/alerts/:patientId', updateMedicalAlerts); // Update Alerts
router.delete('/:id', deleteNote);           // Delete note

module.exports = router;