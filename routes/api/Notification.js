const express = require('express');
const router = express.Router();
const {
    getNotifications,
    deleteNotification,
    markNotificationRead,
    markAllNotificationsRead
} = require('../../Controllers/application/Notification');
const verifyToken = require('../../middleware/auth');

router.get('/all', verifyToken, getNotifications);

// ✅ DELETE a specific notification by ID
router.delete('/delete/:notificationId', verifyToken, deleteNotification);

// ✅ MARK a notification as read
router.put('/mark-as-read/:notificationId', verifyToken, markNotificationRead);

// ✅ MARK ALL notifications as read
router.put('/mark-all-read', verifyToken, markAllNotificationsRead);


module.exports = router;
