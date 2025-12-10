import express from 'express';
const router = express.Router();
import {
  getProductReviews,
  addReview,
  updateReview,
  deleteReview,
  getUserReviews
} from '../controllers/reviewController.js';
import { protect, verified } from '../middleware/auth.js';

router.get('/product/:productId', getProductReviews);
router.get('/user', protect, verified, getUserReviews);
router.post('/', protect, verified, addReview);
router.put('/:id', protect, verified, updateReview);
router.delete('/:id', protect, verified, deleteReview);

export default router;

