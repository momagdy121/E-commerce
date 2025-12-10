import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { UnauthorizedError, ForbiddenError } from '../errors/index.js';

// Protect routes
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new UnauthorizedError('Please log in to access this resource'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash');

    if (!req.user) {
      return next(new UnauthorizedError('User belonging to this token no longer exists'));
    }

    next();
  } catch (error) {
    return next(new UnauthorizedError('Session invalid or expired, please log in again'));
  }
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access denied. Role '${req.user.role}' required.`));
    }
    next();
  };
};

// Check if user is verified
export const verified = (req, res, next) => {
  if (!req.user.isEmailVerified && !req.user.isPhoneVerified) {
    return next(new ForbiddenError('Account not verified. Please verify your email or phone number to access this feature.'));
  }
  next();
};
