const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');

const { protect, adminOnly } = require('../middleware/authMiddleware'); // <--- Import Guard

// Apply protection to all routes in this file
router.use(protect, adminOnly);

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;