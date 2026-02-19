const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({

    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true
    },

    // 1. Access Control
    allowedBranches: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
    }],

    defaultBranch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
    },

    // 2. Identity
    // Changed 'name' to 'fullName' to match Patient/Procedure style (optional but cleaner)
    fullName: { type: String, required: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    role: {
        type: String,
        enum: ['Administrator', 'Doctor', 'Receptionist'],
        default: 'Receptionist'
    },

    mobile: { type: String, trim: true },

    // 3. Status
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Pending'],
        default: 'Active'
    },
    mustChangePassword: { type: Boolean, default: false },

    // ⚡️⚡️ 4. NEW: Doctor Configuration (The Financial Engine) ⚡️⚡️
    // This is ignored for Receptionists/Admins, but critical for Doctors.
    doctorConfig: {
        specialization: { type: String, default: 'General Dentist' }, // e.g., Orthodontist
        registrationNumber: { type: String }, // Medical License #

        // FINANCIALS
        commissionPercentage: { type: Number, default: 0, min: 0, max: 100 }, // The % share
        baseSalary: { type: Number, default: 0 } // Fixed monthly pay (optional)
    }

}, { timestamps: true });

// --- MIDDLEWARE ---

// Encrypt password before saving
UserSchema.pre('save', async function () { // 1. Remove 'next' parameter here

    // 2. If password isn't modified, just return (Promise resolves automatically)
    if (!this.isModified('password')) {
        return;
    }

    // 3. Hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    // 4. No need to call next()
});

// Helper to compare password
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);