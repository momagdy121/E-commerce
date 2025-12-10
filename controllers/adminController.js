import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import Coupon from '../models/Coupon.js';
import Payment from '../models/Payment.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { catchAsync, sendResponse, ApiFeatures } from '../utils/index.js';

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getDashboardStats = catchAsync(async (req, res, next) => {
  const { period = '30' } = req.query; // days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  // Total stats
  const totalUsers = await User.countDocuments();
  const totalProducts = await Product.countDocuments({ isActive: true });
  const totalOrders = await Order.countDocuments();
  const totalRevenue = await Payment.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // Period stats
  const periodOrders = await Order.countDocuments({
    createdAt: { $gte: startDate }
  });

  const periodRevenue = await Payment.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const periodUsers = await User.countDocuments({
    createdAt: { $gte: startDate }
  });

  // Order status breakdown
  const orderStatusBreakdown = await Order.aggregate([
    {
      $group: {
        _id: '$orderStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  // Payment status breakdown
  const paymentStatusBreakdown = await Payment.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }
    }
  ]);

  sendResponse(res, {
    message: 'Dashboard stats retrieved successfully',
    data: {
      totals: {
        users: totalUsers,
        products: totalProducts,
        orders: totalOrders,
        revenue: totalRevenue[0]?.total || 0
      },
      period: {
        orders: periodOrders,
        revenue: periodRevenue[0]?.total || 0,
        users: periodUsers
      },
      breakdown: {
        orderStatus: orderStatusBreakdown,
        paymentStatus: paymentStatusBreakdown
      }
    }
  });
});

// @desc    Get daily sales
// @route   GET /api/admin/analytics/daily-sales
// @access  Private/Admin
export const getDailySales = catchAsync(async (req, res, next) => {
  const { days = 30 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const dailySales = await Payment.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  sendResponse(res, {
    message: 'Daily sales retrieved successfully',
    data: dailySales
  });
});

// @desc    Get monthly revenue
// @route   GET /api/admin/analytics/monthly-revenue
// @access  Private/Admin
export const getMonthlyRevenue = catchAsync(async (req, res, next) => {
  const { months = 12 } = req.query;

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  const monthlyRevenue = await Payment.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  sendResponse(res, {
    message: 'Monthly revenue retrieved successfully',
    data: monthlyRevenue
  });
});

// @desc    Get top selling products
// @route   GET /api/admin/analytics/top-products
// @access  Private/Admin
export const getTopSellingProducts = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const topProducts = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        totalSold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        productId: '$_id',
        productTitle: '$product.title',
        productImage: { $arrayElemAt: ['$product.images', 0] },
        totalSold: 1,
        totalRevenue: 1
      }
    }
  ]);

  sendResponse(res, {
    message: 'Top selling products retrieved successfully',
    data: topProducts
  });
});

// @desc    Get active customers
// @route   GET /api/admin/analytics/active-customers
// @access  Private/Admin
export const getActiveCustomers = catchAsync(async (req, res, next) => {
  const { days = 30, limit = 10 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const activeCustomers = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$userId',
        orderCount: { $sum: 1 },
        totalSpent: { $sum: '$totalPrice' }
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        userId: '$_id',
        userName: '$user.fullName',
        userEmail: '$user.email',
        orderCount: 1,
        totalSpent: 1
      }
    }
  ]);

  sendResponse(res, {
    message: 'Active customers retrieved successfully',
    data: activeCustomers
  });
});

// @desc    Manage users
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = catchAsync(async (req, res, next) => {
  const query = {};
  if (req.query.role) query.role = req.query.role;
  if (req.query.search) {
    query.$or = [
      { fullName: new RegExp(req.query.search, 'i') },
      { email: new RegExp(req.query.search, 'i') }
    ];
  }

  const baseQuery = User.find(query).select('-passwordHash -refreshToken');

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .paginate();

  const users = await features.query;
  const total = await User.countDocuments(query);
  
  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'Users retrieved successfully',
    data: users,
    meta: pagination
  });
});

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
export const updateUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new NotFoundError('User not found'));
  }

  user.role = role;
  await user.save();

  sendResponse(res, {
    message: 'User role updated successfully',
    data: user
  });
});

// @desc    Manage coupons
// @route   GET /api/admin/coupons
// @access  Private/Admin
export const getCoupons = catchAsync(async (req, res, next) => {
  const baseQuery = Coupon.find();

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .paginate();

  const coupons = await features.query;
  const total = await Coupon.countDocuments();
  
  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'Coupons retrieved successfully',
    data: coupons,
    meta: pagination
  });
});

// @desc    Create coupon
// @route   POST /api/admin/coupons
// @access  Private/Admin
export const createCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.create(req.body);

  sendResponse(res, {
    code: 201,
    message: 'Coupon created successfully',
    data: coupon
  });
});

// @desc    Update coupon
// @route   PUT /api/admin/coupons/:id
// @access  Private/Admin
export const updateCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!coupon) {
    return next(new NotFoundError('Coupon not found'));
  }

  sendResponse(res, {
    message: 'Coupon updated successfully',
    data: coupon
  });
});

// @desc    Delete coupon
// @route   DELETE /api/admin/coupons/:id
// @access  Private/Admin
export const deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new NotFoundError('Coupon not found'));
  }

  coupon.isActive = false;
  await coupon.save();

  sendResponse(res, {
    message: 'Coupon deactivated successfully'
  });
});
