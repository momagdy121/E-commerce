import express from 'express';
const router = express.Router();
import {
  createOrder,
  getOrders,
  getOrder,
  cancelOrder,
  updateOrderStatus,
  getAllOrders
} from '../controllers/orderController.js';
import { protect, authorize } from '../middleware/auth.js';

router.use(protect);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/admin/all', authorize('admin'), getAllOrders);
router.get('/:id', getOrder);
router.put('/:id/cancel', cancelOrder);
router.put('/:id/status', authorize('admin'), updateOrderStatus);

export default router;

