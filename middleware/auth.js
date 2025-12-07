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
    return next(new UnauthorizedError('Not authorized to access this route'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash');
    
    if (!req.user) {
      return next(new UnauthorizedError('User not found'));
    }

    next();
  } catch (error) {
    return next(new UnauthorizedError('Not authorized to access this route'));
  }
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`User role '${req.user.role}' is not authorized to access this route`));
    }
    next();
  };
};
