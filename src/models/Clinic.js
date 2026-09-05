const mongoose = require('mongoose');

const ClinicSchema = new mongoose.Schema({
	// Unique Short ID for Staff Login (e.g. SMILE-001)
	clinicId: { type: String, required: true, unique: true, uppercase: true },

	clinicType: {
        type: String,
        enum: ['Dental', 'Dermatology', 'General_Practice', 'Ophthalmology', 'Physiotherapy'],
        default: 'Dental', // Defaults to Dental so your existing legacy DB data doesn't break!
        required: true
    },

	// Legal Details
	name: { type: String, required: true }, // Display Name (e.g. Smile Care)
	legalName: { type: String },            // Registered Name (e.g. Smile Care Pvt Ltd)
	registrationNumber: { type: String },   // License / Registration
	gstin: { type: String },                // Tax ID

	accountStatus: {
		type: String,
		enum: ['Pending_Approval', 'Active', 'Suspended'],
		default: 'Pending_Approval'
	},

	// Contact
	phone: { type: String },
	email: { type: String },
	website: { type: String },

	// Location
	address: { type: String },
	city: { type: String },
	state: { type: String },
	zip: { type: String },

	// Branding (We will use this in the Branding Tab later)
	logo: { type: String },
	primaryColor: { type: String, default: '#1976d2' },

	whatsappConfig: {
		whatsappEnabled: { type: Boolean, default: false },

		// META CLOUD API CREDENTIALS (BYON)
		phoneNumberId: { type: String, default: '' }, // e.g., '109876543210123'
		wabaId: { type: String, default: '' },        // WhatsApp Business Account ID
		accessToken: { type: String, default: '' },     // The clinic's System User token

		// UPGRADED TRIGGERS DICTIONARY
		triggers: {
			type: Map,
			of: new mongoose.Schema({
				enabled: { type: Boolean, default: false },
				templateName: { type: String, default: '' }, // Approved name in Meta (e.g., 'appointment_reminder')
				languageCode: { type: String, default: 'en' }  // e.g., 'en', 'en_US', 'ta'
			}, { _id: false }),
			default: {}
		}
	},
	aiConfig: {
		enabled: {
			type: Boolean,
			default: false
		},
		geminiApiKey: {
			type: String,
			default: ""
		}
	}

}, { timestamps: true });

module.exports = mongoose.model('Clinic', ClinicSchema);