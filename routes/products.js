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
import { protect, authorize, verified } from '../middleware/auth.js';

router.get('/featured', getFeaturedProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);

// Admin routes
router.post('/', protect, verified, authorize('admin', 'vendor'), createProduct);
router.put('/:id', protect, verified, authorize('admin', 'vendor'), updateProduct);
router.delete('/:id', protect, verified, authorize('admin'), deleteProduct);
router.put('/:id/stock', protect, verified, authorize('admin', 'vendor'), updateStock);

export default router;

