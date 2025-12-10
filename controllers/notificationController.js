import Notification from '../models/Notification.js';
import { NotFoundError } from '../errors/index.js';
import { catchAsync, sendResponse, ApiFeatures } from '../utils/index.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = catchAsync(async (req, res, next) => {
  const query = { userId: req.user.id };
  if (req.query.unreadOnly === 'true') {
    query.isRead = false;
  }

  const baseQuery = Notification.find(query);

  const features = new ApiFeatures(baseQuery, req.query)
    .sort()
    .paginate();

  const notifications = await features.query;
  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    userId: req.user.id,
    isRead: false
  });
  
  const pagination = ApiFeatures.getPaginationMeta(
    total,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'Notifications retrieved successfully',
    data: notifications,
    meta: {
      ...pagination,
      unreadCount
    }
  });
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!notification) {
    return next(new NotFoundError('Notification not found'));
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  sendResponse(res, {
    message: 'Notification marked as read',
    data: notification
  });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = catchAsync(async (req, res, next) => {
  await Notification.updateMany(
    { userId: req.user.id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  sendResponse(res, {
    message: 'All notifications marked as read'
  });
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!notification) {
    return next(new NotFoundError('Notification not found'));
  }

  await notification.remove();

  sendResponse(res, {
    message: 'Notification deleted successfully'
  });
});
