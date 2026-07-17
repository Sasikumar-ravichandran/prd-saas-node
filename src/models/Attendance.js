const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    date: { type: String, required: true }, // Format: 'YYYY-MM-DD'
    
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Half-Day', 'Paid Leave', 'Unpaid Leave', 'Weekly Off'],
        required: true,
        default: 'Present'
    },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true }
}, { timestamps: true });

// Ensure only one attendance record per user, per day, per clinic
AttendanceSchema.index({ clinicId: 1, userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);