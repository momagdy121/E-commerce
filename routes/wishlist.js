import express from 'express';
const router = express.Router();
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist
} from '../controllers/wishlistController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.get('/', getWishlist);
router.get('/check/:productId', checkWishlist);
router.post('/products/:productId', addToWishlist);
router.delete('/products/:productId', removeFromWishlist);

export default router;

