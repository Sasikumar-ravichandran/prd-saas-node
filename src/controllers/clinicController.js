const Clinic = require('../models/Clinic');

// @desc    Get MY Clinic Profile
// @route   GET /api/settings/clinic
// @access  Private (Admin/Staff)
const getClinicProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.clinicId) {
            console.log("❌ Missing Clinic ID on User");
            return res.json([]); 
        }

        const clinic = await Clinic.findById(req.user.clinicId);
        
        if (!clinic) {
            console.log("❌ Clinic Not Found in DB");
            return res.status(404).json({ message: 'Clinic not found' });
        }

        res.json(clinic);
    } catch (error) {
        console.error("Fetch Clinic Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update MY Clinic Profile
// @route   PUT /api/settings/clinic
// @access  Private (Admin Only)
const updateClinicProfile = async (req, res) => {
	try {
		const data = req.body;

		// SECURITY FIX:
		// Only update the document that matches my ID.
		// Prevents overwriting other people's clinics.
		const clinic = await Clinic.findByIdAndUpdate(
			req.user.clinicId, // <--- The Filter
			data,              // The Updates
			{ new: true, runValidators: true } // Return updated doc & check schema rules
		);

		if (!clinic) {
			return res.status(404).json({ message: 'Clinic not found' });
		}

		res.json(clinic);
	} catch (error) {
		console.error("Clinic Update Error:", error);
		res.status(500).json({ message: 'Server Error' });
	}
};

module.exports = { getClinicProfile, updateClinicProfile };