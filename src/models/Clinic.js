const mongoose = require('mongoose');

const ClinicSchema = new mongoose.Schema({
	// Unique Short ID for Staff Login (e.g. SMILE-001)
	clinicId: { type: String, required: true, unique: true, uppercase: true },

	// Legal Details
	name: { type: String, required: true }, // Display Name (e.g. Smile Care)
	legalName: { type: String },            // Registered Name (e.g. Smile Care Pvt Ltd)
	registrationNumber: { type: String },   // License / Registration
	gstin: { type: String },                // Tax ID

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
		twilioAccountSid: { type: String, default: '' },
		twilioAuthToken: { type: String, default: '' },
		twilioSenderNumber: { type: String, default: '' },

		//  NEW: A dynamic dictionary of all message templates
		triggers: {
			type: Map,
			of: new mongoose.Schema({
				enabled: { type: Boolean, default: false },
				template: { type: String, default: '' }
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