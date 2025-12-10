import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { catchAsync, sendResponse } from '../utils/index.js';

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
export const getWishlist = catchAsync(async (req, res, next) => {
  let wishlist = await Wishlist.findOne({ userId: req.user.id })
    .populate('productIds', 'title images price discountPrice rating stock');

  if (!wishlist) {
    wishlist = await Wishlist.create({ userId: req.user.id, productIds: [] });
  }

  sendResponse(res, {
    message: 'Wishlist retrieved successfully',
    data: wishlist
  });
});

// @desc    Add product to wishlist
// @route   POST /api/wishlist/products/:productId
// @access  Private
export const addToWishlist = catchAsync(async (req, res, next) => {
  // Verify product exists
  const product = await Product.findById(req.params.productId);
  if (!product || !product.isActive) {
    return next(new NotFoundError('Product not found'));
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
      return next(new BadRequestError('Product already in wishlist'));
    }

    wishlist.productIds.push(req.params.productId);
    await wishlist.save();
  }

  await wishlist.populate('productIds', 'title images price discountPrice rating stock');

  sendResponse(res, {
    message: 'Product added to wishlist successfully',
    data: wishlist
  });
});

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/products/:productId
// @access  Private
export const removeFromWishlist = catchAsync(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ userId: req.user.id });

  if (!wishlist) {
    return next(new NotFoundError('Wishlist not found'));
  }

  wishlist.productIds = wishlist.productIds.filter(
    productId => productId.toString() !== req.params.productId
  );

  await wishlist.save();
  await wishlist.populate('productIds', 'title images price discountPrice rating stock');

  sendResponse(res, {
    message: 'Product removed from wishlist successfully',
    data: wishlist
  });
});

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
export const checkWishlist = catchAsync(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ userId: req.user.id });

  const isInWishlist = wishlist && wishlist.productIds.some(
    productId => productId.toString() === req.params.productId
  );

  sendResponse(res, {
    message: 'Wishlist check completed',
    data: { isInWishlist: !!isInWishlist }
  });
});
