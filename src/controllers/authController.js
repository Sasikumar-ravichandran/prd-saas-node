const User = require('../models/User');
const Clinic = require('../models/Clinic');
const RoleConfig = require('../models/RoleConfig');
const Branch = require('../models/Branch'); // Ensure Branch is imported
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
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log('2222')
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Generate Clinic Short ID (Collision Check)
    let shortId;
    let isUnique = false;
    while (!isUnique) {
      shortId = `CL-${Math.floor(1000 + Math.random() * 9000)}`;
      const existing = await Clinic.findOne({ clinicId: shortId });
      if (!existing) isUnique = true;
    }

    const clinic = await Clinic.create({
      name: clinicName,
      clinicId: shortId
    });

    // Create Admin User (INITIALLY NO BRANCH)
    // The frontend will detect 'defaultBranch: null' and redirect to /setup-branch
    const user = await User.create({
      clinicId: clinic._id,
      name: adminName,
      email,
      password,
      role: 'Administrator',
      allowedBranches: [], 
      defaultBranch: null  
    });

    // Initialize Permissions
    await RoleConfig.create({
      clinicId: clinic._id,
      permissions: {
        admin: ['fin_view_revenue', 'fin_edit_invoice', 'fin_discounts', 'pt_delete', 'pt_export', 'ops_settings', 'ops_calendar', 'branch_manage', 'branch_create', 'user_manage_global'],
        branch_manager: ['fin_view_revenue', 'ops_calendar', 'ops_settings', 'user_manage_local'],
        doctor: ['fin_view_revenue', 'ops_calendar'],
        receptionist: ['ops_calendar', 'fin_edit_invoice'],
        nurse: []
      }
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      clinicId: clinic._id, 
      clinicShortId: clinic.clinicId, 
      token: generateToken(user._id),
      defaultBranch: null // Triggers "Setup Branch" flow
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
    // 1. Find User & Populate Branch Context
    // We explicitly need the 'name' and 'branchCode' for the UI
    const user = await User.findOne({ email })
        .populate('clinicId')
        .populate('defaultBranch', 'name branchCode') 
        .populate('allowedBranches', 'name branchCode');

    // 2. Validate User & Password
    if (user && (await user.matchPassword(password))) {

      // 3. SECURITY: Staff Check
      if (user.role !== 'Administrator') {
        if (!clinicShortId) {
          return res.status(400).json({ message: 'Clinic ID is required for staff login.' });
        }
        if (user.clinicId?.clinicId !== clinicShortId) {
          return res.status(401).json({ message: 'Invalid Clinic ID for this user.' });
        }
      }

      // Force Password Change Check
      if (user.mustChangePassword) {
        return res.json({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
          requirePasswordChange: true 
        });
      }

      // 4. Success Response
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId._id,        
        clinicShortId: user.clinicId.clinicId, 
        token: generateToken(user._id),

        // --- BRANCH DATA ---
        // 1. The ID used for API Headers
        defaultBranch: user.defaultBranch?._id || null, 
        
        // 2. The Display Data (e.g. "Anna Nagar", "BID-001")
        branchName: user.defaultBranch?.name || null,
        branchCode: user.defaultBranch?.branchCode || null,
        
        // 3. The Switcher Options
        allowedBranches: user.allowedBranches || [] 
      });

    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Change Password
// @route   PUT /api/auth/password
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  // 1. Find User with Population (To keep state consistent after update)
  const user = await User.findById(req.user._id)
    .populate('defaultBranch', 'name branchCode')
    .populate('allowedBranches', 'name branchCode');

  if (user && (await user.matchPassword(oldPassword))) {
    user.password = newPassword; 
    user.mustChangePassword = false; 
    user.status = 'Active'; 
    
    await user.save();
    
    // 2. Return Full Object (So frontend doesn't lose branch info)
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),

      // Preserve Branch Data
      defaultBranch: user.defaultBranch?._id || null,
      branchName: user.defaultBranch?.name || null,
      branchCode: user.defaultBranch?.branchCode || null,
      allowedBranches: user.allowedBranches || []
    });
  } else {
    res.status(401).json({ message: 'Invalid old password' });
  }
};

module.exports = { registerClinic, loginUser, changePassword };