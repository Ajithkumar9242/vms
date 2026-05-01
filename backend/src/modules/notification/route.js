const router = require('express').Router();
const NotificationController = require('./controller');
const { protect } = require('../../middlewares/auth');
const { validate, mongoIdParam } = require('../../utils/validators');

router.use(protect);

router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/:id/read', mongoIdParam('id'), validate, NotificationController.markRead);
router.patch('/read-all', NotificationController.markAllRead);

module.exports = router;
