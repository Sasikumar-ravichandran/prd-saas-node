const mongoose = require('mongoose');

const DrugSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  name: { type: String, required: true }, // e.g., "Augmentin 625"
  type: { type: String, default: 'Tablet' }, // Tablet, Syrup, Injection
  genericName: String, // "Amoxicillin + Clavulanic Acid"
  defaultDosage: String, // "1-0-1" (Morning-Afternoon-Night)
  defaultDuration: String, // "5 Days"
  instruction: String, // "After Food"
}, { timestamps: true });

module.exports = mongoose.model('Drug', DrugSchema);