const Procedure = require('../models/Procedure');

// @desc    Get all procedures (Scoped to Clinic)
// @route   GET /api/procedures
// @access  Private
const getProcedures = async (req, res) => {
	try {

		if (!req.user || !req.user.clinicId) {
			return res.json([]);
		}

		// SECURITY: Only find procedures linked to the logged-in user's clinic
		const procedures = await Procedure.find({
			clinicId: req.user.clinicId // <--- FILTER
		}).sort({ code: 1 });

		res.json(procedures);
	} catch (error) {
		res.status(500).json({ message: 'Server Error' });
	}
};

// @desc    Create a new procedure
// @route   POST /api/procedures
// @access  Private
const createProcedure = async (req, res) => {
	try {
		const { code, name, price, commission, active } = req.body;

		// SECURITY: Check for duplicates ONLY within this clinic
		// (Dr. A can have '101' and Dr. B can have '101' - that is allowed now)
		const exists = await Procedure.findOne({
			code,
			clinicId: req.user.clinicId // <--- SCOPED CHECK
		});

		if (exists) {
			return res.status(400).json({ message: `Procedure code '${code}' already exists in your list.` });
		}

		// Create Procedure attached to Clinic
		const procedure = await Procedure.create({
			clinicId: req.user.clinicId, // <--- BIND TO CLINIC
			code,
			name,
			price,
			commission,

			// Defaults
			tax: 0,
			labCost: 0,

			// Map 'active' -> 'isActive'
			isActive: active !== undefined ? active : true
		});

		res.status(201).json(procedure);

	} catch (error) {
		console.error("Create Procedure Error:", error);
		res.status(500).json({ message: 'Server Error' });
	}
};

// @desc    Update procedure
// @route   PUT /api/procedures/:id
// @access  Private
const updateProcedure = async (req, res) => {
	try {
		const { id } = req.params;

		// SECURITY: Find specific doc belonging to THIS clinic
		// We replace findById(id) with findOne({ _id: id, clinicId: ... })
		const procedure = await Procedure.findOne({
			_id: id,
			clinicId: req.user.clinicId
		});

		if (!procedure) return res.status(404).json({ message: 'Procedure not found' });

		// Update fields only if sent
		if (req.body.code) procedure.code = req.body.code;
		if (req.body.name) procedure.name = req.body.name;
		if (req.body.price !== undefined) procedure.price = req.body.price;
		if (req.body.commission !== undefined) procedure.commission = req.body.commission;

		// Handle Status
		if (req.body.active !== undefined) procedure.isActive = req.body.active;
		if (req.body.isActive !== undefined) procedure.isActive = req.body.isActive;

		const updatedProcedure = await procedure.save();
		res.json(updatedProcedure);

	} catch (error) {
		console.error("Update Error:", error);
		res.status(500).json({ message: 'Server Error' });
	}
};

// @desc    Delete procedure
// @route   DELETE /api/procedures/:id
// @access  Private
const deleteProcedure = async (req, res) => {
	try {
		const { id } = req.params;

		// SECURITY: Ensure we only delete if it belongs to us
		const procedure = await Procedure.findOne({
			_id: id,
			clinicId: req.user.clinicId
		});

		if (!procedure) {
			return res.status(404).json({ message: 'Procedure not found' });
		}

		await procedure.deleteOne();

		res.json({ message: 'Procedure removed successfully' });

	} catch (error) {
		console.error("Delete Error:", error);
		res.status(500).json({ message: 'Server Error' });
	}
};

module.exports = { getProcedures, createProcedure, updateProcedure, deleteProcedure };