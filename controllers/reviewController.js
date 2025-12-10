import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/index.js';
import { catchAsync, sendResponse, ApiFeatures } from '../utils/index.js';

// Helper function to update product rating
const updateProductRating = async (productId) => {
  const reviews = await Review.find({ productId });
  
  if (reviews.length === 0) {
    await Product.findByIdAndUpdate(productId, {
      'rating.average': 0,
      'rating.count': 0
    });
    return;
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await Product.findByIdAndUpdate(productId, {
    'rating.average': Math.round(averageRating * 10) / 10, // Round to 1 decimal
    'rating.count': reviews.length
  });
};

// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = catchAsync(async (req, res, next) => {
  const baseQuery = Review.find({ productId: req.params.productId });

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .paginate()
    .populate('userId', 'fullName');

  const reviews = await features.query;
  const total = await Review.countDocuments({ productId: req.params.productId });
  
  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'Product reviews retrieved successfully',
    data: reviews,
    meta: pagination
  });
});

// @desc    Add review
// @route   POST /api/reviews
// @access  Private
export const addReview = catchAsync(async (req, res, next) => {
  const { productId, rating, comment } = req.body;

  // Verify product exists
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new NotFoundError('Product not found'));
  }

  // Check if user already reviewed this product
  const existingReview = await Review.findOne({
    userId: req.user.id,
    productId
  });

  if (existingReview) {
    return next(new BadRequestError('You have already reviewed this product'));
  }

  // Check if user has purchased this product (optional verification)
  const hasPurchased = await Order.findOne({
    userId: req.user.id,
    'items.productId': productId,
    orderStatus: { $in: ['delivered', 'shipped'] }
  });

  const review = await Review.create({
    userId: req.user.id,
    productId,
    rating,
    comment,
    isVerifiedPurchase: !!hasPurchased
  });

  // Update product rating
  await updateProductRating(productId);

  sendResponse(res, {
    code: 201,
    message: 'Review added successfully',
    data: review
  });
});

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = catchAsync(async (req, res, next) => {
  const { rating, comment } = req.body;

  let review = await Review.findById(req.params.id);

  if (!review) {
    return next(new NotFoundError('Review not found'));
  }

  // Check if user owns the review
  if (review.userId.toString() !== req.user.id.toString()) {
    return next(new ForbiddenError('Not authorized to update this review'));
  }

  if (rating) review.rating = rating;
  if (comment !== undefined) review.comment = comment;

  await review.save();

  // Update product rating
  await updateProductRating(review.productId);

  sendResponse(res, {
    message: 'Review updated successfully',
    data: review
  });
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new NotFoundError('Review not found'));
  }

  // Check if user owns the review or is admin
  if (review.userId.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
    return next(new ForbiddenError('Not authorized to delete this review'));
  }

  const productId = review.productId;
  await review.remove();

  // Update product rating
  await updateProductRating(productId);

  sendResponse(res, {
    message: 'Review deleted successfully'
  });
});

// @desc    Get user reviews
// @route   GET /api/reviews/user
// @access  Private
export const getUserReviews = catchAsync(async (req, res, next) => {
  const baseQuery = Review.find({ userId: req.user.id });

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .paginate()
    .populate('productId', 'title images');

  const reviews = await features.query;
  const total = await Review.countDocuments({ userId: req.user.id });
  
  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'User reviews retrieved successfully',
    data: reviews,
    meta: pagination
  });
});
