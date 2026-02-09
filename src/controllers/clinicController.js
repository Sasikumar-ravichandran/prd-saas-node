const Clinic = require('../models/Clinic');

// @desc    Get Clinic Profile
// @route   GET /api/settings/clinic
const getClinicProfile = async (req, res) => {
  try {
    // Find the first record. If not found, return empty object.
    const clinic = await Clinic.findOne();
    res.json(clinic || {});
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update/Create Clinic Profile
// @route   PUT /api/settings/clinic
const updateClinicProfile = async (req, res) => {
  try {
    const data = req.body;

    // "Upsert": Find the first record and update it. 
    // If it doesn't exist, create a new one.
    const clinic = await Clinic.findOneAndUpdate(
      {}, // Filter (Empty means find any)
      data, // Update with this data
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(clinic);
  } catch (error) {
    console.error("Clinic Update Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getClinicProfile, updateClinicProfile };