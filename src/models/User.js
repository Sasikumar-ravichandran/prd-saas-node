const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({

	clinicId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Clinic',
		required: true,
		index: true // Index for fast filtering
	},

	// NEW: Which branches can this user access?
	allowedBranches: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Branch'
	}],

	// NEW: Default branch (where they log in initially)
	defaultBranch: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Branch'
	},

	name: { type: String, required: true },
	email: { type: String, required: true, unique: true },
	// In a real app, this would be hashed (bcrypt). 
	// For now, we store it simply to get the CRUD working.
	password: { type: String, default: '123456' },

	role: {
		type: String,
		enum: ['Administrator', 'Doctor', 'Receptionist'],
		default: 'Receptionist'
	},
	mobile: { type: String, required: false },

	status: {
		type: String,
		enum: ['Active', 'Inactive', 'Pending'],
		default: 'Active'
	},
	mustChangePassword: { type: Boolean, default: false }

}, { timestamps: true });

// Encrypt password before saving
UserSchema.pre('save', async function () {

	// 2. If password isn't changed, just return (Promise resolves automatically)
	if (!this.isModified('password')) return;

	// 3. Hash the password
	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);

});

// Helper to compare password
UserSchema.methods.matchPassword = async function (enteredPassword) {
	return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);