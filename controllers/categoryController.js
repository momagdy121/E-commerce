import Category from '../models/Category.js';
import Product from '../models/Product.js';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
      count: categories.length,
      data: tree.length > 0 ? tree : categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
export const getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parentCategoryId', 'name');

    if (!category || !category.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get products by category
// @route   GET /api/categories/:id/products
// @access  Public
export const getCategoryProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get all subcategories (if any)
    const subcategories = await Category.find({
      parentCategoryId: req.params.id
    });

    const categoryIds = [req.params.id, ...subcategories.map(cat => cat._id)];

    const products = await Product.find({
      categoryId: { $in: categoryIds },
      isActive: true
    })
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('categoryId', 'name');

    const total = await Product.countDocuments({
      categoryId: { $in: categoryIds },
      isActive: true
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req, res, next) => {
  try {
    // If parent category is provided, verify it exists
    if (req.body.parentCategoryId) {
      const parentCategory = await Category.findById(req.body.parentCategoryId);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res, next) => {
  try {
    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Prevent circular reference
    if (req.body.parentCategoryId && req.body.parentCategoryId === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Category cannot be its own parent'
      });
    }

    // If parent category is being updated, verify it exists
    if (req.body.parentCategoryId) {
      const parentCategory = await Category.findById(req.body.parentCategoryId);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
    }

    category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ categoryId: req.params.id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} products. Please reassign products first.`
      });
    }

    // Check if category has subcategories
    const subcategoryCount = await Category.countDocuments({ parentCategoryId: req.params.id });
    if (subcategoryCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${subcategoryCount} subcategories. Please delete or reassign subcategories first.`
      });
    }

    // Soft delete
    category.isActive = false;
    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

