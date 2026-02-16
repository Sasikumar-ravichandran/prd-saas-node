const express = require('express');
const router = express.Router();
const { createBranch, getBranches, updateBranch, deleteBranch } = require('../controllers/branchController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createBranch);
router.get('/', protect, getBranches);
router.route('/:id')
	.put(protect, updateBranch)
	.delete(protect, deleteBranch);

module.exports = router;