const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const RoleConfig = require('../models/RoleConfig');
const Branch = require('../models/Branch');
const Otp = require('../models/Otp');

const { sendEmail, getOtpEmailTemplate } = require('../services/emailService');
// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123azb', { expiresIn: '30d' });
};

// Helper: SHA-256 OTP Hasher
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// ==========================================
// @desc    Send OTP to Email (For Signup or Reset Password)
// @route   POST /api/auth/send-otp
// ==========================================
const sendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({ message: 'Email and purpose are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Validate email format
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    // 2. Prevent OTP Resend Spam (60-second cooldown check)
    const recentOtp = await Otp.findOne({ 
      email: cleanEmail, 
      purpose,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } 
    });

    if (recentOtp) {
      const secondsLeft = Math.ceil((60 * 1000 - (Date.now() - recentOtp.createdAt)) / 1000);
      return res.status(429).json({ 
        message: `Please wait ${secondsLeft} seconds before requesting another code.` 
      });
    }

    // 3. Check existing users based on purpose
    const existingUser = await User.findOne({ email: cleanEmail });

    if (purpose === 'SIGNUP_VERIFY' && existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    // Security: Do not reveal if email is not registered during password reset
    if (purpose === 'PASSWORD_RESET' && !existingUser) {
      return res.status(200).json({
        message: 'If an account exists for this email, an OTP has been sent.',
      });
    }

    // 4. Generate a secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashOtp(otp);

    // 5. Delete existing OTPs for this email and purpose to avoid clutter
    await Otp.deleteMany({ email: cleanEmail, purpose });

    // 6. Save OTP document (expires in 10 minutes)
    await Otp.create({
      email: cleanEmail,
      otpHash,
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // DEV ONLY LOGGING:
    console.log(`[OTP GENERATED] (${purpose}) for ${cleanEmail}: ${otp}`);

    // 7. Dispatch the HTML Email
    const emailHtml = getOtpEmailTemplate(otp, purpose);
    const subject = purpose === 'SIGNUP_VERIFY' 
      ? 'Verify Your Clinic Registration' 
      : 'Password Reset Verification Code';

    await sendEmail({
      to: cleanEmail,
      subject,
      html: emailHtml,
    });

    return res.status(200).json({ message: 'OTP sent successfully to your email.' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({ message: 'Failed to send verification code. Please try again later.' });
  }
};

// ==========================================
// @desc    Register New Clinic (Admin Sign Up - OTP Protected)
// @route   POST /api/auth/register
// ==========================================
const registerClinic = async (req, res) => {
  try {
    const { clinicName, fullName, email, password, otp } = req.body;

    // 1. Validation
    if (!fullName || !clinicName || !email || !password || !otp) {
      return res.status(400).json({ message: 'Missing required fields, including verification OTP.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // 2. Verify Signup OTP
    const otpRecord = await Otp.findOne({ email: cleanEmail, purpose: 'SIGNUP_VERIFY' });

    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new code.' });
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code.' });
    }

    if (hashOtp(otp) !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: `Invalid OTP code. (${5 - otpRecord.attempts} attempts left)` });
    }

    // 3. Create Clinic
    let shortId = `CL-${Math.floor(1000 + Math.random() * 9000)}`;
    const clinic = await Clinic.create({
      name: clinicName,
      clinicId: shortId,
    });

    // 4. Create Admin User (WITHOUT BRANCH)
    const user = await User.create({
      clinicId: clinic._id,
      name: fullName,
      fullName: fullName,
      email: cleanEmail,
      password,
      role: 'Administrator',
      defaultBranch: null,
      allowedBranches: [],
      doctorConfig: { commissionPercentage: 0 },
    });

    // 5. Initialize Permissions — one document per role
    await RoleConfig.insertMany([
      {
        clinicId: clinic._id,
        roleId: 'administrator',
        permissions: [
          'fin_view_revenue',
          'fin_edit_invoice',
          'fin_discounts',
          'pt_delete',
          'pt_export',
          'ops_settings',
          'ops_calendar',
          'branch_manage',
          'branch_create',
          'user_manage_global',
        ],
      },
      {
        clinicId: clinic._id,
        roleId: 'doctor',
        permissions: ['fin_view_revenue', 'ops_calendar'],
      },
      {
        clinicId: clinic._id,
        roleId: 'receptionist',
        permissions: ['ops_calendar', 'fin_edit_invoice'],
      },
    ]);

    // 6. Delete OTP after successful registration
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      clinicId: clinic._id,
      token: generateToken(user._id),
      defaultBranch: null,
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// @desc    Verify OTP and Reset Password
// @route   POST /api/auth/reset-password
// ==========================================
const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const otpRecord = await Otp.findOne({ email: cleanEmail, purpose: 'PASSWORD_RESET' });

    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new code.' });
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code.' });
    }

    if (hashOtp(otp) !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: `Invalid OTP code. (${5 - otpRecord.attempts} attempts left)` });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    // Directly assign password; ensure your User model has a pre('save') hook to hash it!
    user.password = newPassword;
    user.mustChangePassword = false;
    user.status = 'Active';
    await user.save();

    // Delete OTP after successful reset
    await Otp.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({ message: 'An error occurred while resetting your password.' });
  }
};


const verifyOtp = async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    
    if (!email || !otp || !purpose) {
      return res.status(400).json({ message: 'Email, OTP, and purpose are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const otpRecord = await Otp.findOne({ email: cleanEmail, purpose });

    if (!otpRecord) return res.status(400).json({ message: 'OTP expired or not found.' });
    
    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ message: 'Too many incorrect attempts.' });
    }

    if (hashOtp(otp) !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: `Invalid OTP code. (${5 - otpRecord.attempts} attempts left)` });
    }

    // OTP is valid! We don't delete it yet, because register/resetPassword will need it.
    res.status(200).json({ message: 'OTP verified successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during verification.' });
  }
};

// ==========================================
// @desc    Login User (UNCHANGED)
// @route   POST /api/auth/login
// ==========================================
const loginUser = async (req, res) => {
  const { email, password, clinicShortId } = req.body;

  try {
    const user = await User.findOne({ email })
      .populate('clinicId')
      .populate('defaultBranch', 'name branchName branchCode')
      .populate('allowedBranches', 'name branchName branchCode');

    if (user && (await user.matchPassword(password))) {

      // BLOCK LOGIN IF CLINIC IS NOT ACTIVE
      if (user.clinicId?.accountStatus === 'Pending_Approval') {
        return res.status(403).json({ 
          message: 'Your clinic account is awaiting admin approval. We will notify you via email shortly.' 
        });
      }

      if (user.clinicId?.accountStatus === 'Suspended') {
        return res.status(403).json({ 
          message: 'Your clinic account has been suspended. Please contact support.' 
        });
      }

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
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
          requirePasswordChange: true,
        });
      }

      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId._id,
        clinicShortId: user.clinicId.clinicId,
        token: generateToken(user._id),
        defaultBranch: user.defaultBranch?._id || null,
        branchName: user.defaultBranch?.name || null,
        branchCode: user.defaultBranch?.branchCode || null,
        allowedBranches: user.allowedBranches || [],
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ==========================================
// @desc    Change Password (In-App Password Change - UNCHANGED)
// @route   PUT /api/auth/password
// ==========================================
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
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
      defaultBranch: user.defaultBranch?._id || null,
      branchName: user.defaultBranch?.name || null,
      branchCode: user.defaultBranch?.branchCode || null,
      allowedBranches: user.allowedBranches || [],
    });
  } else {
    res.status(401).json({ message: 'Invalid old password' });
  }
};

module.exports = {
  sendOtp,
  registerClinic,
  loginUser,
  changePassword,
  resetPasswordWithOtp,
  verifyOtp
};