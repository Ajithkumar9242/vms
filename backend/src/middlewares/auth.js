const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');

/**
 * Protect routes — verifies JWT and attaches user to req.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return ApiResponse.error(res, 'Not authorized. No token provided.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return ApiResponse.error(res, 'User not found.', 401);
    }

    if (!user.isActive) {
      return ApiResponse.error(res, 'Account deactivated. Contact admin.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Token expired. Please login again.', 401);
    }
    return ApiResponse.error(res, 'Not authorized. Token invalid.', 401);
  }
};

/**
 * Role-based access control middleware.
 * Usage: authorize('admin', 'super_admin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Not authorized.', 401);
    }
    if (!roles.includes(req.user.role)) {
      return ApiResponse.error(res, 'You do not have permission to perform this action.', 403);
    }
    next();
  };
};

module.exports = { protect, authorize };
