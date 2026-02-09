const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Get token from header
      token = req.headers.authorization.split(' ')[1];

      // 2. Verify Token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Get User from Token
      // Use 'const' first to check existence
      const user = await User.findById(decoded.id).select('-password');

      // SAFETY CHECK: If token is valid but user was deleted, STOP here.
      if (!user) {
        return res.status(401).json({ message: 'User not found / Authorization denied' });
      }

      // Attach user to request
      req.user = user;
      next(); 

    } catch (error) {
      console.error("Auth Middleware Error:", error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
     // No token provided
     return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'Administrator') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

module.exports = { protect, adminOnly };