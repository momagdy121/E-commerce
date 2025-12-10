import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { catchAsync, sendResponse, ApiFeatures } from '../utils/index.js';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = catchAsync(async (req, res, next) => {
  const { includeProducts } = req.query;

  let categories = await Category.find({ isActive: true })
    .populate('parentCategoryId', 'name')
    .sort({ name: 1 });

  // Build tree structure
  const buildTree = (categories, parentId = null) => {
    return categories
      .filter(cat => {
        if (parentId === null) {
          return !cat.parentCategoryId;
        }
        return cat.parentCategoryId && cat.parentCategoryId.toString() === parentId.toString();
      })
      .map(cat => ({
        ...cat.toObject(),
        children: buildTree(categories, cat._id)
      }));
  };

  const tree = buildTree(categories);

  if (includeProducts === 'true') {
    // Get product counts for each category
    for (let category of categories) {
      const productCount = await Product.countDocuments({
        categoryId: category._id,
        isActive: true
      });
      category.productCount = productCount;
    }
  }

  sendResponse(res, {
    message: 'Categories retrieved successfully',
    data: tree.length > 0 ? tree : categories
  });
});

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
export const getCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id)
    .populate('parentCategoryId', 'name');

  if (!category || !category.isActive) {
    return next(new NotFoundError('We couldn\'t find the category you requested.'));
  }

  sendResponse(res, {
    message: 'Category retrieved successfully',
    data: category
  });
});

// @desc    Get products by category
// @route   GET /api/categories/:id/products
// @access  Public
export const getCategoryProducts = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new NotFoundError('Category not found'));
  }

  // Get all subcategories (if any)
  const subcategories = await Category.find({
    parentCategoryId: req.params.id
  });

  const categoryIds = [req.params.id, ...subcategories.map(cat => cat._id)];

  const baseQuery = Product.find({
    categoryId: { $in: categoryIds },
    isActive: true
  });

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .paginate()
    .populate('categoryId', 'name');

  const products = await features.query;
  const total = await Product.countDocuments({
    categoryId: { $in: categoryIds },
    isActive: true
  });

  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'Category products retrieved successfully',
    data: products,
    meta: pagination
  });
});

// @desc    Create category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = catchAsync(async (req, res, next) => {
  // If parent category is provided, verify it exists
  if (req.body.parentCategoryId) {
    const parentCategory = await Category.findById(req.body.parentCategoryId);
    if (!parentCategory) {
      return next(new NotFoundError('Parent category not found'));
    }
  }

  const category = await Category.create(req.body);

  sendResponse(res, {
    code: 201,
    message: 'Category created successfully',
    data: category
  });
});

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = catchAsync(async (req, res, next) => {
  let category = await Category.findById(req.params.id);

  if (!category) {
    return next(new NotFoundError('The category you want to update was not found.'));
  }

  // Prevent circular reference
  if (req.body.parentCategoryId && req.body.parentCategoryId === req.params.id) {
    return next(new BadRequestError('Category cannot be its own parent'));
  }

  // If parent category is being updated, verify it exists
  if (req.body.parentCategoryId) {
    const parentCategory = await Category.findById(req.body.parentCategoryId);
    if (!parentCategory) {
      return next(new NotFoundError('Parent category not found'));
    }
  }

  category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  sendResponse(res, {
    message: 'Category updated successfully',
    data: category
  });
});

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new NotFoundError('The category you want to delete was not found.'));
  }

  // Check if category has products
  const productCount = await Product.countDocuments({ categoryId: req.params.id });
  if (productCount > 0) {
    return next(new BadRequestError(`Cannot delete category with ${productCount} products. Please reassign products first.`));
  }

  // Check if category has subcategories
  const subcategoryCount = await Category.countDocuments({ parentCategoryId: req.params.id });
  if (subcategoryCount > 0) {
    return next(new BadRequestError(`Cannot delete category with ${subcategoryCount} subcategories. Please delete or reassign subcategories first.`));
  }

  // Soft delete
  category.isActive = false;
  await category.save();

  sendResponse(res, {
    message: 'Category deleted successfully'
  });
});
