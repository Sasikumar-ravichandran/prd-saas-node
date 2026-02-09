const User = require('../models/User');

// @desc    Get all users (Staff) for MY Clinic
// @route   GET /api/users
// @access  Private (Admin Only)
const getUsers = async (req, res) => {
	try {
		if (!req.user || !req.user.clinicId) {
			return res.json([]);
		}
		// SECURITY: Only find users belonging to the logged-in Admin's clinic
		// We exclude the password field for security
		const users = await User.find({
			clinicId: req.user.clinicId
		}).select('-password');

		res.json(users);
	} catch (error) {
		res.status(500).json({ message: 'Server Error' });
	}
};

// @desc    Create a new staff member
// @route   POST /api/users
// @access  Private (Admin Only)
const createUser = async (req, res) => {
	try {
		const { name, email, role, status } = req.body;

		// 1. Check if user exists (Globally unique email is best for SaaS)
		const userExists = await User.findOne({ email });
		if (userExists) {
			return res.status(400).json({ message: 'User with this email already exists' });
		}

		// 2. Create User linked to THIS Clinic
		const user = await User.create({
			clinicId: req.user.clinicId, // <--- THE BINDING
			name,
			email,
			role, // 'Doctor', 'Receptionist', 'Nurse'
			status: status || 'Active',

			// Default Password (In production, you'd email them a setup link)
			password: '123456'
		});

		res.status(201).json({
			_id: user._id,
			name: user.name,
			email: user.email,
			role: user.role,
			message: 'Staff member created successfully'
		});

	} catch (error) {
		console.error(error);
		res.status(500).json({ message: 'Server Error' });
	}
};

// @desc    Update staff details
// @route   PUT /api/users/:id
// @access  Private (Admin Only)
const updateUser = async (req, res) => {
	try {
		if (!req.user || !req.user.clinicId) {
			return res.json([]);
		}
		const { id } = req.params;

		// SECURITY: Find user ONLY if they are in my clinic
		const user = await User.findOne({
			_id: id,
			clinicId: req.user.clinicId
		});

		if (!user) return res.status(404).json({ message: 'User not found' });

		// Update fields
		user.name = req.body.name || user.name;
		user.email = req.body.email || user.email;
		user.role = req.body.role || user.role;
		user.status = req.body.status || user.status;

		// Password Update Logic (Optional: Only if admin sends it)
		if (req.body.password) {
			user.password = req.body.password;
			// The pre-save hook in User.js will automatically hash this!
		}

		const updatedUser = await user.save();

		res.json({
			_id: updatedUser._id,
			name: updatedUser.name,
			email: updatedUser.email,
			role: updatedUser.role,
			status: updatedUser.status
		});

	} catch (error) {
		console.error(error);
		res.status(500).json({ message: 'Server Error' });
	}
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin Only)
const deleteUser = async (req, res) => {
	try {
		const { id } = req.params;
		if (!req.user || !req.user.clinicId) {
			return res.json([]);
		}
		// SECURITY: Ensure we only delete users from OUR clinic
		const user = await User.findOne({
			_id: id,
			clinicId: req.user.clinicId
		});

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Prevent Admin from deleting themselves (Safety Check)
		if (user._id.toString() === req.user._id.toString()) {
			return res.status(400).json({ message: 'You cannot delete yourself.' });
		}

		await user.deleteOne();

		res.json({ message: 'User removed successfully' });

	} catch (error) {
		res.status(500).json({ message: 'Server Error' });
	}
};

module.exports = { getUsers, createUser, updateUser, deleteUser };