import express from 'express';
const router = express.Router();
import {
  createPaymentIntent,
  verifyPayment,
  createPayPalPayment,
  executePayPalPayment,
  handleStripeWebhook,
  getPayment,
  processCOD
} from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';

// Webhook route (no auth, uses signature verification)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Protected routes
router.use(protect);
router.use(paymentLimiter);

router.post('/create-intent', createPaymentIntent);
router.post('/verify', verifyPayment);
router.post('/paypal/create', createPayPalPayment);
router.post('/paypal/execute', executePayPalPayment);
router.post('/cod', processCOD);
router.get('/:paymentId', getPayment);

export default router;

