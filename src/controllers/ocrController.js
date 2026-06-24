const multer = require('multer');
const fs = require('fs'); // ⚡️ ADDED: File System module to read files from disk
const { extractFormData } = require('../services/ocrService');
const Clinic = require('../models/Clinic');

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }
});

const scanIntakeForm = async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: "No image file provided." });
		}

		console.log(`[OCR] Scanning form for Clinic ID: ${req.user.clinicId}`);

		// ⚡️ BULLETPROOF FILE HANDLING: Check if it's in Memory or on Disk
		let imageBuffer;
		if (req.file.buffer) {
			imageBuffer = req.file.buffer; // It was saved in RAM
		} else if (req.file.path) {
			imageBuffer = fs.readFileSync(req.file.path); // It was saved to Disk
		} else {
			return res.status(400).json({ success: false, message: "File processing error." });
		}

		const clinic = await Clinic.findById(req.user.clinicId);
		const apiKey = clinic?.aiConfig?.geminiApiKey;

		if (!clinic?.aiConfig?.enabled || !apiKey) {
			// Optional: If using Disk storage, delete the file so it doesn't take up space
			if (req.file.path) fs.unlinkSync(req.file.path);

			return res.status(400).json({ success: false, message: "API_KEY_MISSING" });
		}

		// Pass the safely extracted imageBuffer to the service
		const extractedData = await extractFormData(imageBuffer, req.file.mimetype, apiKey);

		// Optional: Clean up the file from your server after a successful scan
		if (req.file.path) {
			fs.unlinkSync(req.file.path);
		}

		res.status(200).json({ success: true, data: extractedData });

	} catch (error) {
		console.error("[OCR Controller] Form Scan Error:", error);

		// ⚡️ FIXED: Proper try/catch for synchronous file deletion
		if (req.file && req.file.path) {
			try {
				fs.unlinkSync(req.file.path);
			} catch (fsError) {
				console.error("Could not delete temp file:", fsError);
			}
		}

		const errorString = error.message ? error.message.toLowerCase() : "";
		if (error.status === 429 || errorString.includes('429') || errorString.includes('quota')) {
			throw new Error("LIMIT_REACHED"); // Pass this specific flag to the controller
		}

		if (error.message === "API_KEY_MISSING") {
			return res.status(400).json({ success: false, message: "API_KEY_MISSING" });
		}

		if (error.status === 429 || error.message === "LIMIT_REACHED") {
			return res.status(429).json({ success: false, message: "LIMIT_REACHED" });
		}

		res.status(500).json({ success: false, message: "Failed to read form." });
	}
};

module.exports = { upload, scanIntakeForm };