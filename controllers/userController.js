import User from '../models/User.js';
import Order from '../models/Order.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { catchAsync, sendResponse, ApiFeatures } from '../utils/index.js';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  sendResponse(res, {
    message: 'Profile retrieved successfully',
    data: user
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = catchAsync(async (req, res, next) => {
  const { fullName, phone, preferences } = req.body;

  const user = await User.findById(req.user.id);

  if (fullName) user.fullName = fullName;
  if (phone) user.phone = phone;
  if (preferences) {
    user.preferences = { ...user.preferences, ...preferences };
  }

  await user.save();

  sendResponse(res, {
    message: 'Profile updated successfully',
    data: user
  });
});

// @desc    Add address
// @route   POST /api/users/addresses
// @access  Private
export const addAddress = catchAsync(async (req, res, next) => {
  const { street, city, state, zipCode, country, isDefault } = req.body;

  const user = await User.findById(req.user.id);

  // If this is set as default, unset other defaults
  if (isDefault) {
    user.addresses.forEach(addr => {
      addr.isDefault = false;
    });
  }

  user.addresses.push({
    street,
    city,
    state,
    zipCode,
    country: country || 'US',
    isDefault: isDefault || false
  });

  await user.save();

  sendResponse(res, {
    code: 201,
    message: 'Address added successfully',
    data: user.addresses
  });
});

// @desc    Update address
// @route   PUT /api/users/addresses/:addressId
// @access  Private
export const updateAddress = catchAsync(async (req, res, next) => {
  const { street, city, state, zipCode, country, isDefault } = req.body;

  const user = await User.findById(req.user.id);
  const address = user.addresses.id(req.params.addressId);

  if (!address) {
    return next(new NotFoundError('Address not found'));
  }

  if (street) address.street = street;
  if (city) address.city = city;
  if (state) address.state = state;
  if (zipCode) address.zipCode = zipCode;
  if (country) address.country = country;

  // If setting as default, unset others
  if (isDefault) {
    user.addresses.forEach(addr => {
      if (addr._id.toString() !== req.params.addressId) {
        addr.isDefault = false;
      }
    });
    address.isDefault = true;
  }

  await user.save();

  sendResponse(res, {
    message: 'Address updated successfully',
    data: user.addresses
  });
});

// @desc    Remove address
// @route   DELETE /api/users/addresses/:addressId
// @access  Private
export const removeAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) {
    return next(new NotFoundError('Address not found'));
  }
  user.addresses.pull(req.params.addressId);
  await user.save();

  sendResponse(res, {
    message: 'Address removed successfully',
    data: user.addresses
  });
});

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+passwordHash');

  // Check current password
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return next(new BadRequestError('Current password is incorrect'));
  }

  // Update password
  user.passwordHash = newPassword;
  await user.save();

  sendResponse(res, {
    message: 'Password changed successfully'
  });
});

// @desc    Get order history
// @route   GET /api/users/orders
// @access  Private
export const getOrderHistory = catchAsync(async (req, res, next) => {
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
    message: 'Order history retrieved successfully',
    data: orders,
    meta: pagination
  });
});

// @desc    Get single order
// @route   GET /api/users/orders/:orderId
// @access  Private
export const getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    userId: req.user.id
  }).populate('items.productId', 'title images description');

  if (!order) {
    return next(new NotFoundError('Order not found'));
  }

  sendResponse(res, {
    message: 'Order retrieved successfully',
    data: order
  });
});
