import express from 'express';
const router = express.Router();
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  socialLogin,
  getMe
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validateRegister, validateLogin } from '../middleware/validators/authValidator.js';

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.put('/reset-password/:resettoken', authLimiter, resetPassword);
router.post('/social-login', socialLogin);
router.get('/me', protect, getMe);

export default router;

