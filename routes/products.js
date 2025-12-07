import express from 'express';
const router = express.Router();
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getFeaturedProducts
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/auth.js';

router.get('/featured', getFeaturedProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);

// Admin routes
router.post('/', protect, authorize('admin', 'vendor'), createProduct);
router.put('/:id', protect, authorize('admin', 'vendor'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);
router.put('/:id/stock', protect, authorize('admin', 'vendor'), updateStock);

export default router;

