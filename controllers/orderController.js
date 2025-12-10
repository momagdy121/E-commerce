import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import Payment from '../models/Payment.js';
import { sendEmail } from '../utils/emailService.js';
import { sendNotification } from '../utils/notificationService.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { catchAsync, sendResponse, ApiFeatures } from '../utils/index.js';

// @desc    Create order
// @route   POST /api/orders
// @access  Private
export const createOrder = catchAsync(async (req, res, next) => {
  const { shippingAddress, paymentMethod, couponCode, notes } = req.body;

  // Get user cart
  const cart = await Cart.findOne({ userId: req.user.id })
    .populate('items.productId');

  if (!cart || cart.items.length === 0) {
    return next(new BadRequestError('Your cart is empty. Please add items before checking out.'));
  }

  // Verify stock and build order items
  const orderItems = [];
  let totalPrice = 0;

  for (const cartItem of cart.items) {
    const product = await Product.findById(cartItem.productId._id);

    if (!product || !product.isActive) {
      return next(new BadRequestError(`Product ${cartItem.productId.title} is no longer available`));
    }

    if (product.stock < cartItem.quantity) {
      return next(new BadRequestError(`Insufficient stock for ${product.title}. Available: ${product.stock}`));
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
      return next(new BadRequestError('Invalid or expired coupon code'));
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return next(new BadRequestError('This coupon has reached its maximum usage limit.'));
    }

    if (totalPrice < coupon.minPurchaseAmount) {
      return next(new BadRequestError(`Minimum purchase amount of ${coupon.minPurchaseAmount} required for this coupon`));
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

  sendResponse(res, {
    code: 201,
    message: 'Order created successfully',
    data: order
  });
});

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
export const getOrders = catchAsync(async (req, res, next) => {
  const baseQuery = Order.find({ userId: req.user.id });

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .paginate()
    .populate('items.productId', 'title images');

  const orders = await features.query;
  const total = await Order.countDocuments({ userId: req.user.id });

  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'Orders retrieved successfully',
    data: orders,
    meta: pagination
  });
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('items.productId')
    .populate('paymentId');

  if (!order) {
    return next(new NotFoundError('We could not locate this order.'));
  }

  sendResponse(res, {
    message: 'Order retrieved successfully',
    data: order
  });
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!order) {
    return next(new NotFoundError('We could not locate this order to update.'));
  }

  if (order.orderStatus === 'cancelled') {
    return next(new BadRequestError('Order is already cancelled'));
  }

  if (['shipped', 'delivered'].includes(order.orderStatus)) {
    return next(new BadRequestError('Cannot cancel order that has been shipped or delivered'));
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

  sendResponse(res, {
    message: 'Order cancelled successfully',
    data: order
  });
});

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = catchAsync(async (req, res, next) => {
  const { orderStatus, trackingNumber } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new NotFoundError('We could not locate this order.'));
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

  sendResponse(res, {
    message: 'Order status updated successfully',
    data: order
  });
});

// @desc    Get all orders (Admin)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
export const getAllOrders = catchAsync(async (req, res, next) => {
  const query = {};
  if (req.query.status) query.orderStatus = req.query.status;
  if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;

  const baseQuery = Order.find(query);

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .paginate()
    .populate('userId', 'fullName email');

  const orders = await features.query;
  const total = await Order.countDocuments(query);

  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'All orders retrieved successfully',
    data: orders,
    meta: pagination
  });
});
