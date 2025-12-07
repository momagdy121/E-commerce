import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
export const getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ userId: req.user.id })
      .populate('productIds', 'title images price discountPrice rating stock');

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId: req.user.id, productIds: [] });
    }

    res.status(200).json({
      success: true,
      count: wishlist.productIds.length,
      data: wishlist
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add product to wishlist
// @route   POST /api/wishlist/products/:productId
// @access  Private
export const addToWishlist = async (req, res, next) => {
  try {
    // Verify product exists
    const product = await Product.findById(req.params.productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    let wishlist = await Wishlist.findOne({ userId: req.user.id });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId: req.user.id,
        productIds: [req.params.productId]
      });
    } else {
      // Check if product already in wishlist
      if (wishlist.productIds.includes(req.params.productId)) {
        return res.status(400).json({
          success: false,
          message: 'Product already in wishlist'
        });
      }

      wishlist.productIds.push(req.params.productId);
      await wishlist.save();
    }

    await wishlist.populate('productIds', 'title images price discountPrice rating stock');

    res.status(200).json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/products/:productId
// @access  Private
export const removeFromWishlist = async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user.id });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.productIds = wishlist.productIds.filter(
      productId => productId.toString() !== req.params.productId
    );

    await wishlist.save();
    await wishlist.populate('productIds', 'title images price discountPrice rating stock');

    res.status(200).json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
export const checkWishlist = async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user.id });

    const isInWishlist = wishlist && wishlist.productIds.some(
      productId => productId.toString() === req.params.productId
    );

    res.status(200).json({
      success: true,
      data: { isInWishlist: !!isInWishlist }
    });
  } catch (error) {
    next(error);
  }
};

