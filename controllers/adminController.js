import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import Coupon from '../models/Coupon.js';
import Payment from '../models/Payment.js';

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getDashboardStats = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
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
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily sales
// @route   GET /api/admin/analytics/daily-sales
// @access  Private/Admin
export const getDailySales = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
      data: dailySales
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly revenue
// @route   GET /api/admin/analytics/monthly-revenue
// @access  Private/Admin
export const getMonthlyRevenue = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
      data: monthlyRevenue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top selling products
// @route   GET /api/admin/analytics/top-products
// @access  Private/Admin
export const getTopSellingProducts = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
      count: topProducts.length,
      data: topProducts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active customers
// @route   GET /api/admin/analytics/active-customers
// @access  Private/Admin
export const getActiveCustomers = async (req, res, next) => {
  try {
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

    res.status(200).json({
      success: true,
      count: activeCustomers.length,
      data: activeCustomers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manage users
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      search
    } = req.query;

    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { fullName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-passwordHash -refreshToken')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manage coupons
// @route   GET /api/admin/coupons
// @access  Private/Admin
export const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: coupons.length,
      data: coupons
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create coupon
// @route   POST /api/admin/coupons
// @access  Private/Admin
export const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);

    res.status(201).json({
      success: true,
      data: coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update coupon
// @route   PUT /api/admin/coupons/:id
// @access  Private/Admin
export const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.status(200).json({
      success: true,
      data: coupon
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete coupon
// @route   DELETE /api/admin/coupons/:id
// @access  Private/Admin
export const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isActive = false;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

