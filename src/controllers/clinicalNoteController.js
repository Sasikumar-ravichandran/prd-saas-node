const ClinicalNote = require('../models/ClinicalNote');
const Patient = require('../models/Patient');

// @desc    Get All Notes for a Patient (The Timeline)
// @route   GET /api/clinical-notes/:patientId
const getNotes = async (req, res) => {
  try {
    const notes = await ClinicalNote.find({ 
      patientId: req.params.patientId,
      clinicId: req.user.clinicId 
    }).sort({ visitDate: -1 }); // Newest first

    res.json(notes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add a New Clinical Note
// @route   POST /api/clinical-notes
const createNote = async (req, res) => {
  try {
    const { patientId, content, type, tags, visitDate } = req.body;

    const note = await ClinicalNote.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId,
      patientId,
      doctorId: req.user._id, // The logged-in doctor
      doctorName: req.user.name,
      content,
      type,
      tags,
      visitDate: visitDate || Date.now()
    });

    // OPTIONAL: Update Patient's "Last Visit" date automatically
    await Patient.findByIdAndUpdate(patientId, { lastVisit: Date.now() });

    res.status(201).json(note);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create note' });
  }
};

// @desc    Update Medical Alerts (Allergies/Conditions) on Patient
// @route   PUT /api/clinical-notes/alerts/:patientId
const updateMedicalAlerts = async (req, res) => {
  try {
    const { medicalConditions, allergies } = req.body;

    const patient = await Patient.findOne({ 
        _id: req.params.patientId, 
        clinicId: req.user.clinicId 
    });

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    patient.medicalConditions = medicalConditions || [];
    patient.allergies = allergies || "";
    
    await patient.save();

    res.json(patient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update alerts' });
  }
};

// @desc    Delete a Note (In case of error)
// @route   DELETE /api/clinical-notes/:id
const deleteNote = async (req, res) => {
    try {
        const note = await ClinicalNote.findById(req.params.id);
        if(!note) return res.status(404).json({ message: 'Note not found' });
        
        // Security check
        if(note.clinicId.toString() !== req.user.clinicId.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await note.deleteOne();
        res.json({ message: 'Note deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
}

module.exports = { getNotes, createNote, updateMedicalAlerts, deleteNote };