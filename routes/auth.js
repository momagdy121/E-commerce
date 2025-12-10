import express from 'express';
const router = express.Router();
import passport from 'passport';
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,

  googleCallback,
  verifyCode,
  resendCode,
  addEmail,
  addPhone
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
console.log('Registering Auth Routes...');
import { authLimiter } from '../middleware/rateLimiter.js';
import { validateRegister, validateLogin } from '../middleware/validators/authValidator.js';

router.post('/register', authLimiter, validateRegister, register);
router.post('/verify-code', authLimiter, verifyCode);
router.post('/resend-code', authLimiter, resendCode);
router.post('/add-email', protect, addEmail);
router.post('/add-phone', protect, addPhone);
router.post('/login', authLimiter, validateLogin, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.put('/reset-password/:resettoken', authLimiter, resetPassword);


// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), googleCallback);

export default router;

