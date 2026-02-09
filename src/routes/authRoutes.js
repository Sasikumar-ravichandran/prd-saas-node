const express = require('express');
const router = express.Router();
const { registerClinic, loginUser } = require('../controllers/authController');

router.post('/register', registerClinic);
router.post('/login', loginUser);

module.exports = router;