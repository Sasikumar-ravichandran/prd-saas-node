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
    name: { type: String, required: true, trim: true }, // Used widely in your app
    fullName: { type: String, trim: true }, // Kept for your compatibility

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

    // ⚡️⚡️ 4. UNIVERSAL COMPENSATION (Applies to everyone) ⚡️⚡️
    baseSalary: { type: Number, default: 0 }, 
    commissionRate: { type: Number, default: 0, min: 0, max: 100 }, 

    // 5. DOCTOR CLINICAL CONFIG (Only used if role is Doctor)
    doctorConfig: {
        specialization: { type: String, default: 'General Dentist' }, 
        registrationNumber: { type: String } 
    }

}, { timestamps: true });

// --- MIDDLEWARE ---

// Encrypt password before saving
UserSchema.pre('save', async function () { 
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Helper to compare password
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);