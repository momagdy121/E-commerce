import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Review from '../models/Review.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { catchAsync, sendResponse, ApiFeatures } from '../utils/index.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = catchAsync(async (req, res, next) => {
  // Build base query with active products filter
  const baseQuery = Product.find({ isActive: true });

  // Extended Search: Also search active categories
  const extraConditions = [];
  if (req.query.search) {
    const matchingCategories = await Category.find({
      name: { $regex: req.query.search, $options: 'i' },
      isActive: true
    }).select('_id');

    if (matchingCategories.length > 0) {
      const categoryIds = matchingCategories.map(cat => cat._id);
      extraConditions.push({ categoryId: { $in: categoryIds } });
    }
  }

  // Apply query features
  const features = new ApiFeatures(baseQuery, req.query)
    .filter(extraConditions)
    .sort()
    .paginate()
    .limitFields()
    .populate('categoryId', 'name');

  // Execute query
  const products = await features.query;

  // Get total count for pagination
  // Note: countDocument needs to use the same logic, but we handle it via filter()
  const countQuery = Product.find({ isActive: true });
  // We need to re-apply filter to count query to get accurate total
  const countFeatures = new ApiFeatures(countQuery, req.query).filter(extraConditions);
  const total = await Product.countDocuments(countFeatures.query.getQuery());

  // Get pagination metadata
  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'Products retrieved successfully',
    data: products,
    meta: pagination
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('categoryId', 'name parentCategoryId');

  if (!product || !product.isActive) {
    return next(new NotFoundError('We couldn\'t find the product you requested.'));
  }

  // Get reviews
  const reviews = await Review.find({ productId: req.params.id })
    .populate('userId', 'fullName')
    .sort({ createdAt: -1 })
    .limit(10);

  sendResponse(res, {
    message: 'Product retrieved successfully',
    data: {
      product,
      reviews
    }
  });
});

// @desc    Create product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = catchAsync(async (req, res, next) => {
  // Verify category exists
  const category = await Category.findById(req.body.categoryId);
  if (!category) {
    return next(new NotFoundError('The category for this product does not exist.'));
  }

  const product = await Product.create(req.body);

  sendResponse(res, {
    code: 201,
    message: 'Product created successfully',
    data: product
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = catchAsync(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new NotFoundError('The product you want to update could not be found.'));
  }

  // If category is being updated, verify it exists
  if (req.body.categoryId) {
    const category = await Category.findById(req.body.categoryId);
    if (!category) {
      return next(new NotFoundError('Category not found'));
    }
  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  sendResponse(res, {
    message: 'Product updated successfully',
    data: product
  });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new NotFoundError('Product not found'));
  }

  // Soft delete
  product.isActive = false;
  await product.save();

  sendResponse(res, {
    message: 'Product deleted successfully'
  });
});

// @desc    Update product stock
// @route   PUT /api/products/:id/stock
// @access  Private/Admin
export const updateStock = catchAsync(async (req, res, next) => {
  const { stock } = req.body;

  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new NotFoundError('The product you want to delete could not be found.'));
  }

  product.stock = stock;
  await product.save();

  sendResponse(res, {
    message: 'Stock updated successfully',
    data: product
  });
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = catchAsync(async (req, res, next) => {
  const products = await Product.find({
    isActive: true,
    'rating.average': { $gte: 4 }
  })
    .sort({ 'rating.average': -1, 'rating.count': -1 })
    .limit(10)
    .populate('categoryId', 'name');

  sendResponse(res, {
    message: 'Featured products retrieved successfully',
    data: products
  });
});
