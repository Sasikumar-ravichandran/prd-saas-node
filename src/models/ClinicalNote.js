const mongoose = require('mongoose');

const ClinicalNoteSchema = new mongoose.Schema({
	clinicId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Clinic',
		required: true
	},
	branchId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Branch',
		required: true
	},
	patientId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Patient',
		required: true
	},
	doctorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	doctorName: { type: String }, // Store name for faster read access

	visitDate: {
		type: Date,
		default: Date.now
	},

	type: {
		type: String,
		enum: ['Consultation', 'Procedure', 'Follow-up', 'Emergency'],
		default: 'Consultation'
	},

	content: {
		type: String,
		required: [true, 'Note content is required']
	},

	tags: [{ type: String }], // e.g., ["Pain", "X-Ray", "Scaling"]

}, { timestamps: true });

module.exports = mongoose.model('ClinicalNote', ClinicalNoteSchema);