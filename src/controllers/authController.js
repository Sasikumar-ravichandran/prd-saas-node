const User = require('../models/User');
const Clinic = require('../models/Clinic');
const RoleConfig = require('../models/RoleConfig');
const Branch = require('../models/Branch');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
};

// @desc    Register New Clinic (Admin Sign Up)
// @route   POST /api/auth/register
// controllers/authController.js

const registerClinic = async (req, res) => {
  try {
    const { clinicName, fullName, email, password } = req.body;

    // 1. Validation
    if (!fullName || !clinicName || !email || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // 2. Create Clinic
    let shortId = `CL-${Math.floor(1000 + Math.random() * 9000)}`;
    const clinic = await Clinic.create({
      name: clinicName,
      clinicId: shortId
    });

    // 3. Create Admin User (WITHOUT BRANCH)
    // This allows your frontend to catch 'defaultBranch: null' and redirect.
    const user = await User.create({
      clinicId: clinic._id,
      fullName: fullName,
      email,
      password,
      role: 'Administrator',

      // ⚡️ KEY: Set this to null so the frontend knows to redirect!
      defaultBranch: null,
      allowedBranches: [],

      doctorConfig: { commissionPercentage: 0 }
    });

    // 4. Initialize Permissions
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
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      clinicId: clinic._id,
      token: generateToken(user._id),

      // ⚡️ Return null so frontend redirects to /setup-branch
      defaultBranch: null
    });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login User
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  const { email, password, clinicShortId } = req.body;

  try {
    const user = await User.findOne({ email })
      .populate('clinicId')
      .populate('defaultBranch', 'name branchName branchCode')
      .populate('allowedBranches', 'name branchName branchCode');

    if (user && (await user.matchPassword(password))) {

      // Staff Check
      if (user.role !== 'Administrator') {
        if (!clinicShortId) {
          return res.status(400).json({ message: 'Clinic ID is required for staff login.' });
        }
        if (user.clinicId?.clinicId !== clinicShortId) {
          return res.status(401).json({ message: 'Invalid Clinic ID for this user.' });
        }
      }

      // Password Change Check
      if (user.mustChangePassword) {
        return res.json({
          _id: user._id,
          fullName: user.fullName, // Use fullName
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
          requirePasswordChange: true
        });
      }

      res.json({
        _id: user._id,
        fullName: user.fullName, // Use fullName
        email: user.email,
        role: user.role,
        clinicId: user.clinicId._id,
        clinicShortId: user.clinicId.clinicId,
        token: generateToken(user._id),

        // Branch Data
        defaultBranch: user.defaultBranch?._id || null,
        branchName: user.defaultBranch?.name || null,
        branchCode: user.defaultBranch?.branchCode || null,
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

  const user = await User.findById(req.user._id)
    .populate('defaultBranch', 'name branchName branchCode')
    .populate('allowedBranches', 'name branchName branchCode');

  if (user && (await user.matchPassword(oldPassword))) {
    user.password = newPassword;
    user.mustChangePassword = false;
    user.status = 'Active';

    await user.save();

    res.json({
      _id: user._id,
      fullName: user.fullName, // Use fullName
      email: user.email,
      role: user.role,
      token: generateToken(user._id),

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