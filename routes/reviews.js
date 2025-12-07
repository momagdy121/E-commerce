import express from 'express';
const router = express.Router();
import {
  getProductReviews,
  addReview,
  updateReview,
  deleteReview,
  getUserReviews
} from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';

router.get('/product/:productId', getProductReviews);
router.get('/user', protect, getUserReviews);
router.post('/', protect, addReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

export default router;

