import express from 'express';
const router = express.Router();
import {
  getDashboardStats,
  getDailySales,
  getMonthlyRevenue,
  getTopSellingProducts,
  getActiveCustomers,
  getUsers,
  updateUserRole,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/stats', getDashboardStats);

// Analytics
router.get('/analytics/daily-sales', getDailySales);
router.get('/analytics/monthly-revenue', getMonthlyRevenue);
router.get('/analytics/top-products', getTopSellingProducts);
router.get('/analytics/active-customers', getActiveCustomers);

// User Management
router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);

// Coupon Management
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

export default router;

