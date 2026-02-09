const User = require('../models/User');
const Clinic = require('../models/Clinic');
const RoleConfig = require('../models/RoleConfig'); // <--- Import this
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
};

// @desc    Register New Clinic (Admin Sign Up)
// @route   POST /api/auth/register
const registerClinic = async (req, res) => {
  try {
    const { clinicName, adminName, email, password } = req.body;

    // 1. Check if user exists (Globally unique email)
    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User with this email already exists' });
    }

    // 2. Generate Unique Clinic Short ID (e.g., CL-4921)
    let shortId;
    let isUnique = false;
    
    // Simple Loop to ensure uniqueness (Collision protection)
    while (!isUnique) {
        shortId = `CL-${Math.floor(1000 + Math.random() * 9000)}`;
        const existing = await Clinic.findOne({ clinicId: shortId });
        if (!existing) isUnique = true;
    }

    // 3. Create Clinic
    const clinic = await Clinic.create({
      name: clinicName,
      clinicId: shortId
    });

    // 4. Create Admin User linked to Clinic
    // Note: The User model's pre-save hook will hash this password automatically
    const user = await User.create({
      clinicId: clinic._id,
      name: adminName,
      email,
      password, 
      role: 'Administrator'
    });

    // 5. Initialize Default Roles for this Clinic
    // (This ensures the settings page works immediately)
    await RoleConfig.create({
        clinicId: clinic._id,
        permissions: {
            admin: ['fin_view_revenue', 'fin_edit_invoice', 'fin_discounts', 'pt_delete', 'pt_export', 'ops_settings', 'ops_calendar'],
            doctor: ['fin_view_revenue', 'ops_calendar'],
            receptionist: ['ops_calendar', 'fin_edit_invoice'],
            nurse: []
        }
    });

    // 6. Return Token & Data
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      clinicId: clinic._id, // Mongo ID
      clinicShortId: clinic.clinicId, // Readable ID (CL-1234)
      token: generateToken(user._id),
    });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Login User
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  const { email, password, clinicShortId } = req.body;

  try {
    // 1. Find User & Populate Clinic info
    // We need the Clinic document to verify the Short ID
    const user = await User.findOne({ email }).populate('clinicId');

    // 2. Validate User & Password
    if (user && (await user.matchPassword(password))) {
      
      // 3. SECURITY: Staff Check
      // If the user is NOT an Administrator, they MUST provide the correct Clinic ID.
      // This prevents a receptionist from logging into the wrong clinic interface.
      if (user.role !== 'Administrator') {
         
         if (!clinicShortId) {
             return res.status(400).json({ message: 'Clinic ID is required for staff login.' });
         }
         
         // Compare input ID (CL-1234) with Database ID (CL-1234)
         // Note: user.clinicId is the populated object
         if (user.clinicId.clinicId !== clinicShortId) {
             return res.status(401).json({ message: 'Invalid Clinic ID for this user.' });
         }
      }

      // 4. Success Response
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId._id,        // Internal Mongo ID (for API calls)
        clinicShortId: user.clinicId.clinicId, // Readable ID (for Display)
        token: generateToken(user._id),
      });

    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { registerClinic, loginUser };