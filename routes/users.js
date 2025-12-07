import express from 'express';
const router = express.Router();
import {
  getProfile,
  updateProfile,
  addAddress,
  updateAddress,
  removeAddress,
  changePassword,
  getOrderHistory,
  getOrder
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/addresses', addAddress);
router.put('/addresses/:addressId', updateAddress);
router.delete('/addresses/:addressId', removeAddress);
router.put('/change-password', changePassword);
router.get('/orders', getOrderHistory);
router.get('/orders/:orderId', getOrder);

export default router;

