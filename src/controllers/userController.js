const User = require('../models/User');

// @desc    Get all users
const getUsers = async (req, res) => {
    try {
        const users = await User.find({ clinicId: req.user.clinicId })
            .select('-password') 
            .populate('defaultBranch', 'branchName name branchCode') // Get Branch Name
            .sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a new staff member
const createUser = async (req, res) => {
    try {
        const { 
            name, fullName, email, role, status, mobile, password,
            allowedBranches, defaultBranch, doctorConfig 
        } = req.body;

        // 1. Branch Validation
        const targetBranch = defaultBranch || req.branchId || req.user.defaultBranch;
        if (!targetBranch) return res.status(400).json({ message: "No active branch found." });

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        // 2. Create User
        const user = await User.create({
            clinicId: req.user.clinicId,
            fullName: fullName || name, 
            email,
            role,
            status: status || 'Active',
            mobile,
            password: password || '123456', // Default password
            mustChangePassword: true,
            defaultBranch: targetBranch, 
            allowedBranches: allowedBranches && allowedBranches.length > 0 ? allowedBranches : [targetBranch],
            doctorConfig: role === 'Doctor' ? doctorConfig : undefined
        });

        // 3. ⚡️ POPULATE BEFORE RESPONDING
        // This ensures the frontend gets the branch NAME, not just the ID
        await user.populate('defaultBranch', 'branchName name branchCode');

        // 4. ⚡️ SEND EVERYTHING
        // user.toObject() converts the Mongoose doc to a plain JS object so we don't miss anything
        const userResponse = user.toObject();
        delete userResponse.password; // Security: remove password

        res.status(201).json({ ...userResponse, message: 'User created successfully' });

    } catch (error) {
        console.error("Create User Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update staff details
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findOne({ _id: id, clinicId: req.user.clinicId });

        if (!user) return res.status(404).json({ message: 'User not found' });

        // 1. Update Basic Fields
        if (req.body.fullName || req.body.name) user.fullName = req.body.fullName || req.body.name;
        if (req.body.email) user.email = req.body.email;
        if (req.body.mobile) user.mobile = req.body.mobile;
        if (req.body.role) user.role = req.body.role;
        if (req.body.status) user.status = req.body.status;

        // 2. Update Complex Fields (Doctor Config)
        if (user.role === 'Doctor' && req.body.doctorConfig) {
            user.doctorConfig = { ...user.doctorConfig, ...req.body.doctorConfig };
        }

        // 3. Update Branch
        if (req.body.defaultBranch) user.defaultBranch = req.body.defaultBranch;
        
        // 4. Save
        const updatedUser = await user.save();

        // 5. ⚡️ POPULATE AGAIN (Critical Step)
        await updatedUser.populate('defaultBranch', 'branchName name branchCode');

        // 6. ⚡️ SEND EVERYTHING (The Fix)
        // Instead of manually picking fields, we send the whole object.
        const responseObj = updatedUser.toObject();
        delete responseObj.password;

        res.json({ ...responseObj, message: "User updated successfully" });

    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

const deleteUser = async (req, res) => {
    try {
        await User.deleteOne({ _id: req.params.id, clinicId: req.user.clinicId });
        res.json({ message: 'User removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };