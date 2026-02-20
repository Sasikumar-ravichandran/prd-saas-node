const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser, getMe, 
    updateMe, 
    changePassword } = require('../controllers/userController');

const { protect } = require('../middleware/authMiddleware'); // <--- Import Guard

// Apply protection to all routes in this file
router.use(protect);
router.get('/me', getMe);
router.put('/me', updateMe);
router.put('/change-password', changePassword);
router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;