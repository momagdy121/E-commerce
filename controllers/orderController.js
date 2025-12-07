import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import Payment from '../models/Payment.js';
import { sendEmail } from '../utils/emailService.js';
import { sendNotification } from '../utils/notificationService.js';

// @desc    Create order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod, couponCode, notes } = req.body;

    // Get user cart
    const cart = await Cart.findOne({ userId: req.user.id })
      .populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Verify stock and build order items
    const orderItems = [];
    let totalPrice = 0;

    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.productId._id);

      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${cartItem.productId.title} is no longer available`
        });
      }

      if (product.stock < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.title}. Available: ${product.stock}`
        });
      }

      const itemPrice = product.discountPrice || product.price;
      const itemTotal = itemPrice * cartItem.quantity;
      totalPrice += itemTotal;

      orderItems.push({
        productId: product._id,
        title: product.title,
        quantity: cartItem.quantity,
        price: itemPrice,
        image: product.images[0]
      });
    }

    // Apply coupon if provided
    let discount = 0;
    let coupon = null;

    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      });

      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired coupon code'
        });
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({
          success: false,
          message: 'Coupon usage limit reached'
        });
      }

      if (totalPrice < coupon.minPurchaseAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum purchase amount of ${coupon.minPurchaseAmount} required for this coupon`
        });
      }

      if (coupon.discountType === 'percentage') {
        discount = (totalPrice * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount) {
          discount = Math.min(discount, coupon.maxDiscountAmount);
        }
      } else {
        discount = coupon.discountValue;
      }

      totalPrice -= discount;
    }

    // Create order
    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      totalPrice,
      discount,
      couponCode: couponCode ? couponCode.toUpperCase() : null,
      shippingAddress,
      paymentMethod: paymentMethod || 'COD',
      notes
    });

    // Update coupon usage
    if (coupon) {
      coupon.usedCount += 1;
      await coupon.save();
    }

    // Reduce stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    // Create payment record
    const payment = await Payment.create({
      orderId: order._id,
      userId: req.user.id,
      amount: totalPrice,
      method: paymentMethod || 'COD',
      status: paymentMethod === 'COD' ? 'pending' : 'processing'
    });

    order.paymentId = payment._id;
    await order.save();

    // Send notification
    await sendNotification({
      userId: req.user.id,
      type: 'order_placed',
      title: 'Order Placed',
      message: `Your order #${order._id} has been placed successfully`,
      data: { orderId: order._id }
    });

    // Send email
    try {
      await sendEmail({
        email: req.user.email,
        subject: 'Order Confirmation',
        message: `Your order #${order._id} has been placed successfully. Total: $${totalPrice}`
      });
    } catch (error) {
      console.error('Email sending failed:', error);
    }

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('items.productId', 'title images');

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user.id
    })
      .populate('items.productId')
      .populate('paymentId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }

    if (['shipped', 'delivered'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order that has been shipped or delivered'
      });
    }

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }

    // Update order status
    order.orderStatus = 'cancelled';
    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded';
    }
    await order.save();

    // Update payment
    if (order.paymentId) {
      await Payment.findByIdAndUpdate(order.paymentId, {
        status: 'refunded'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, trackingNumber } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (orderStatus) {
      order.orderStatus = orderStatus;
    }

    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    await order.save();

    // Send notification
    await sendNotification({
      userId: order.userId,
      type: 'order_status_updated',
      title: 'Order Status Updated',
      message: `Your order #${order._id} status has been updated to ${orderStatus}`,
      data: { orderId: order._id, orderStatus }
    });

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
export const getAllOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus
    } = req.query;

    const query = {};
    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const orders = await Order.find(query)
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

