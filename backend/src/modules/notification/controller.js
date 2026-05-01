const NotificationService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

class NotificationController {
  static async getNotifications(req, res, next) {
    try {
      const { page, limit } = req.query;
      const data = await NotificationService.getByUser(req.user._id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      });
      return ApiResponse.success(res, data, 'Notifications fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getUnreadCount(req, res, next) {
    try {
      const data = await NotificationService.getUnreadCount(req.user._id);
      return ApiResponse.success(res, data, 'Unread count fetched');
    } catch (error) {
      next(error);
    }
  }

  static async markRead(req, res, next) {
    try {
      const data = await NotificationService.markRead(req.params.id, req.user._id);
      return ApiResponse.success(res, data, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  static async markAllRead(req, res, next) {
    try {
      const data = await NotificationService.markAllRead(req.user._id);
      return ApiResponse.success(res, data, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NotificationController;
