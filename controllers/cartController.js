import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { catchAsync, sendResponse } from '../utils/index.js';

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
export const getCart = catchAsync(async (req, res, next) => {
  let cart = await Cart.findOne({ userId: req.user.id })
    .populate('items.productId', 'title images price discountPrice stock');

  if (!cart) {
    cart = await Cart.create({ userId: req.user.id, items: [] });
  }

  // Update prices from product (in case prices changed)
  for (let item of cart.items) {
    if (item.productId) {
      const product = await Product.findById(item.productId._id);
      if (product) {
        item.price = product.discountPrice || product.price;
      }
    }
  }

  await cart.save();

  sendResponse(res, {
    message: 'Cart retrieved successfully',
    data: cart
  });
});

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private
export const addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;

  // Verify product exists and is active
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new NotFoundError('The product you are adding is not available.'));
  }

  // Check stock
  if (product.stock < quantity) {
    return next(new BadRequestError(`Only ${product.stock} items available in stock`));
  }

  let cart = await Cart.findOne({ userId: req.user.id });

  if (!cart) {
    cart = await Cart.create({ userId: req.user.id, items: [] });
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.productId.toString() === productId
  );

  const itemPrice = product.discountPrice || product.price;

  if (existingItemIndex > -1) {
    // Update quantity
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;

    if (product.stock < newQuantity) {
      return next(new BadRequestError(`Only ${product.stock} items available in stock`));
    }

    cart.items[existingItemIndex].quantity = newQuantity;
    cart.items[existingItemIndex].price = itemPrice;
  } else {
    // Add new item
    cart.items.push({
      productId,
      quantity,
      price: itemPrice
    });
  }

  await cart.save();

  sendResponse(res, {
    message: 'Item added to cart successfully',
    data: cart
  });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private
export const updateCartItem = catchAsync(async (req, res, next) => {
  const { quantity } = req.body;

  if (quantity < 1) {
    return next(new BadRequestError('Quantity must be at least 1 unit.'));
  }

  const cart = await Cart.findOne({ userId: req.user.id });

  if (!cart) {
    return next(new NotFoundError('Cart not found'));
  }

  const item = cart.items.id(req.params.itemId);
  if (!item) {
    return next(new NotFoundError('Item not found in cart'));
  }

  // Check stock
  const product = await Product.findById(item.productId);
  if (!product || product.stock < quantity) {
    return next(new BadRequestError(`Only ${product.stock} items available in stock`));
  }

  item.quantity = quantity;
  item.price = product.discountPrice || product.price;

  await cart.save();

  sendResponse(res, {
    message: 'Cart item updated successfully',
    data: cart
  });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private
export const removeFromCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ userId: req.user.id });

  if (!cart) {
    return next(new NotFoundError('Your cart could not be cleared because it does not exist.'));
  }

  cart.items.id(req.params.itemId).remove();
  await cart.save();

  sendResponse(res, {
    message: 'Item removed from cart successfully',
    data: cart
  });
});

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
export const clearCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ userId: req.user.id });

  if (!cart) {
    return next(new NotFoundError('Cart not found'));
  }

  cart.items = [];
  await cart.save();

  sendResponse(res, {
    message: 'Cart cleared successfully',
    data: cart
  });
});

// @desc    Merge guest cart with user cart
// @route   POST /api/cart/merge
// @access  Private
export const mergeCart = catchAsync(async (req, res, next) => {
  const { guestCartItems } = req.body;

  let cart = await Cart.findOne({ userId: req.user.id });

  if (!cart) {
    cart = await Cart.create({ userId: req.user.id, items: [] });
  }

  for (const guestItem of guestCartItems) {
    const product = await Product.findById(guestItem.productId);
    if (!product || !product.isActive) continue;

    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === guestItem.productId
    );

    const itemPrice = product.discountPrice || product.price;

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + guestItem.quantity;
      if (product.stock >= newQuantity) {
        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].price = itemPrice;
      }
    } else {
      if (product.stock >= guestItem.quantity) {
        cart.items.push({
          productId: guestItem.productId,
          quantity: guestItem.quantity,
          price: itemPrice
        });
      }
    }
  }

  await cart.save();

  sendResponse(res, {
    message: 'Cart merged successfully',
    data: cart
  });
});
