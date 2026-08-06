// middleware/superAdminMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protectSuperAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123azb');

      // Fetch user and explicitly check the flag
      const user = await User.findById(decoded.id).select('-password');

      if (!user || user.isSuperAdmin !== true) {
        return res.status(403).json({ 
          message: 'Security Alert: Access denied. SaaS Founder privileges required.' 
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Super Admin Auth Error:', error.message);
      return res.status(401).json({ message: 'Session expired or invalid token.' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token provided.' });
  }
};

module.exports = { protectSuperAdmin };