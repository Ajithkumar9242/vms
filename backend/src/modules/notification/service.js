const Notification = require('../../models/Notification');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');

/**
 * Notification Service — in-app notification management.
 */
class NotificationService {
  /**
   * Create a notification for a user.
   */
  static async create(userId, { title, message, type = 'info', metadata = null }) {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      metadata,
    });
    return notification;
  }

  /**
   * Get notifications for a user (paginated, newest first).
   */
  static async getByUser(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return { notifications, total, unreadCount, page, limit };
  }

  /**
   * Mark a single notification as read.
   */
  static async markRead(notificationId, userId) {
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new AppError('Invalid notification ID', 400);
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    return notification;
  }

  /**
   * Mark all notifications as read for a user.
   */
  static async markAllRead(userId) {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );
    return { updated: result.modifiedCount };
  }

  /**
   * Get unread count for a user.
   */
  static async getUnreadCount(userId) {
    const count = await Notification.countDocuments({ userId, isRead: false });
    return { unreadCount: count };
  }

  /**
   * Send SMS notification (Placeholder fallback)
   * @param {string} phone - Recipient phone number
   * @param {string} message - SMS message content
   */
  static async sendSMS(phone, message) {
    if (!phone) return;

    // In production, integrate Twilio, AWS SNS, or local SMS gateway here
    console.log(`\n📱 [SMS FALLBACK] To: ${phone}`);
    console.log(`✉️  Message: ${message}\n`);

    return true;
  }
}

module.exports = NotificationService;
