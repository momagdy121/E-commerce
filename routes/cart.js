import express from 'express';
const router = express.Router();
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart
} from '../controllers/cartController.js';
import { protect } from '../middleware/auth.js';

router.use(protect);

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeFromCart);
router.delete('/', clearCart);
router.post('/merge', mergeCart);

export default router;

