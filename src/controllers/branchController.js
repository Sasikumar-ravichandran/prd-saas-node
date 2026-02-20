const Branch = require('../models/Branch');
const User = require('../models/User');

// @desc    Create a new Branch
// @route   POST /api/branches
const createBranch = async (req, res) => {
    try {
        const { branchName, address, phone } = req.body;
        const clinicId = req.user.clinicId;

        // 1. GENERATE BRANCH ID (BID-001, BID-002...)
        // We count how many branches ALREADY exist for this clinic
        const branchCount = await Branch.countDocuments({ clinicId });
        
        // Pad with zeros: 1 -> "001", 12 -> "012"
        const nextNum = (branchCount + 1).toString().padStart(3, '0');
        const branchCode = `BID-${nextNum}`;
        
        // 2. Create Branch
        const branch = await Branch.create({
            clinicId,
            branchName,
            branchCode, // "BID-001"
            address,
            phone,
            isActive: true,
            chairCount: Number(chairCount) || 1
        });

        // 3. AUTO-ASSIGN TO ADMIN
        // If it's the first branch, set as default.
        if (req.user.allowedBranches.length === 0) {
            req.user.allowedBranches.push(branch._id);
            req.user.defaultBranch = branch._id;
            await req.user.save();
        } else {
            // CRITICAL: If Admin creates a 2nd branch, they must have access to it immediately
            req.user.allowedBranches.push(branch._id);
            await req.user.save();
        }

        res.status(201).json({
            ...branch._doc, // Send full branch object
            message: 'Branch created successfully',
            isFirstBranch: branchCount === 0 
        });

    } catch (error) {
        console.error("Create Branch Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get All Branches
// @route   GET /api/branches
const getBranches = async (req, res) => {
    try {
        const branches = await Branch.find({ clinicId: req.user.clinicId });
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update a Branch
// @route   PUT /api/branches/:id
const updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { branchName, address, phone, chairCount } = req.body;

        const branch = await Branch.findOneAndUpdate(
            { _id: id, clinicId: req.user.clinicId }, // Security check
            { branchName, address, phone, chairCount },
            { new: true }
        );

        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' });
        }

        res.json(branch);
    } catch (error) {
        console.error("Update Branch Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete a Branch
// @route   DELETE /api/branches/:id
const deleteBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;

        // 1. SAFETY CHECK: Count remaining branches
        const branchCount = await Branch.countDocuments({ clinicId });
        
        if (branchCount <= 1) {
            return res.status(400).json({ 
                message: 'Action Denied. You must maintain at least one active branch.' 
            });
        }

        // 2. PERFORM DELETE
        // We ensure we only delete if the branch matches the ID AND the Clinic ID
        const branch = await Branch.findOneAndDelete({ _id: id, clinicId });

        if (!branch) {
            return res.status(404).json({ message: 'Branch not found or access denied' });
        }

        // 3. CLEANUP USER PERMISSIONS
        // Remove this branch ID from the 'allowedBranches' array of ALL users in this clinic.
        // If we don't do this, users might try to switch to a branch that no longer exists.
        await User.updateMany(
            { clinicId: clinicId },
            { 
                $pull: { allowedBranches: id }, // Remove ID from array
            }
        );
        
        // Optional: If any user had this as their 'defaultBranch', set it to null
        // This forces them to pick a new branch on next login
        await User.updateMany(
            { clinicId: clinicId, defaultBranch: id },
            { $set: { defaultBranch: null } }
        );

        res.json({ message: 'Branch deleted successfully' });

    } catch (error) {
        console.error("Delete Branch Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { 
    createBranch, 
    getBranches, 
    updateBranch, 
    deleteBranch 
};