const Procedure = require('../models/Procedure');

// @desc    Get all procedures (Scoped to Clinic)
// @route   GET /api/procedures
// @access  Private
const getProcedures = async (req, res) => {
	try {
		if (!req.user || !req.user.clinicId) {
			return res.json([]);
		}

		const procedures = await Procedure.find({
			clinicId: req.user.clinicId
		})
			.sort({ category: 1, code: 1 }); // Sorted by Category first, then Code

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
        // ⚡️ UPDATED: Added labCost & category, Removed commission
        const { code, name, price, labCost, category, active } = req.body;

        // Check for duplicates
        const exists = await Procedure.findOne({
            code,
            clinicId: req.user.clinicId 
        });

        if (exists) {
            return res.status(400).json({ message: `Procedure code '${code}' already exists.` });
        }

        const procedure = await Procedure.create({
            clinicId: req.user.clinicId,
            code,
            name,
            price,
            
            // ⚡️ NEW FIELDS
            labCost: labCost || 0, 
            category: category || 'General',

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

        const procedure = await Procedure.findOne({
            _id: id,
            clinicId: req.user.clinicId
        });

        if (!procedure) return res.status(404).json({ message: 'Procedure not found' });

        // Update standard fields
        if (req.body.code) procedure.code = req.body.code;
        if (req.body.name) procedure.name = req.body.name;
        if (req.body.price !== undefined) procedure.price = req.body.price;

        // ⚡️ NEW FIELDS UPDATES
        if (req.body.labCost !== undefined) procedure.labCost = req.body.labCost;
        if (req.body.category) procedure.category = req.body.category;

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