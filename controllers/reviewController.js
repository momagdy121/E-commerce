import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;

    const reviews = await Review.find({ productId: req.params.productId })
      .populate('userId', 'fullName')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ productId: req.params.productId });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add review
// @route   POST /api/reviews
// @access  Private
export const addReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      userId: req.user.id,
      productId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
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

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
export const updateReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    let review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    if (rating) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    await review.save();

    // Update product rating
    await updateProductRating(review.productId);

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review or is admin
    if (review.userId.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    const productId = review.productId;
    await review.remove();

    // Update product rating
    await updateProductRating(productId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user reviews
// @route   GET /api/reviews/user
// @access  Private
export const getUserReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ userId: req.user.id })
      .populate('productId', 'title images')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

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

