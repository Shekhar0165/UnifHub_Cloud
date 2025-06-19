const express = require('express');
const router = express.Router();
const {
  HandleGetUserSettings,
  HandleUpdateLikesNotification,
  HandleUpdateCommentsNotification,
  HandleUpdateFollowsNotification,
  HandleUpdateMessagesNotification,
  HandleUpdatePostsNotification,
  HandleUpdatePrivateAccount,
  HandleUpdateOnlineStatus,
  HandleEnableAllUserSettings
} = require('../../Controllers/application/UserSettings');

const authMiddleware = require('../../middleware/auth'); // if using JWT

router.get('/', authMiddleware, HandleGetUserSettings);
router.put('/likes', authMiddleware, HandleUpdateLikesNotification);
router.put('/comments', authMiddleware, HandleUpdateCommentsNotification);
router.put('/follows', authMiddleware, HandleUpdateFollowsNotification);
router.put('/messages', authMiddleware, HandleUpdateMessagesNotification);
router.put('/posts', authMiddleware, HandleUpdatePostsNotification);
router.put('/private-account', authMiddleware, HandleUpdatePrivateAccount);
router.put('/online-status', authMiddleware, HandleUpdateOnlineStatus);
router.get('/start', authMiddleware, HandleEnableAllUserSettings);

module.exports = router;
