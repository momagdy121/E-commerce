import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private
export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Verify product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`
      });
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
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available in stock`
        });
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

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private
export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    // Check stock
    const product = await Product.findById(item.productId);
    if (!product || product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`
      });
    }

    item.quantity = quantity;
    item.price = product.discountPrice || product.price;

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private
export const removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items.id(req.params.itemId).remove();
    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
export const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Merge guest cart with user cart
// @route   POST /api/cart/merge
// @access  Private
export const mergeCart = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

