const mongoose = require('mongoose');

const RecallLogSchema = new mongoose.Schema({
    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic',
        required: true
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    stage: {
        type: String,
        enum: ['PHASE_1_NUDGE', 'PHASE_2_RECALL', 'PHASE_3_REACTIVATION'],
        required: true
    },
    sentAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['SENT', 'FAILED'],
        default: 'SENT'
    },
    errorDetails: {
        type: String
    }
}, { timestamps: true });

// Ensure a patient never receives the exact same stage alert for the same past appointment
RecallLogSchema.index({ appointmentId: 1, stage: 1 }, { unique: true });

module.exports = mongoose.model('RecallLog', RecallLogSchema);