import express from 'express';
const router = express.Router();
import {
  getCategories,
  getCategory,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/auth.js';

router.get('/', getCategories);
router.get('/:id', getCategory);
router.get('/:id/products', getCategoryProducts);

// Admin routes
router.post('/', protect, authorize('admin'), createCategory);
router.put('/:id', protect, authorize('admin'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);

export default router;

