const express = require('express');
const router = express.Router();
const userActivityController = require('../../Controllers/application/UserActivity');
const auth = require('../../middleware/auth');

// Route to get a user's activity data
router.get('/:userId', userActivityController.getUserActivity);

// GitHub related routes
router.post('/:userId/github', userActivityController.connectGitHub);
router.get('/:userId/github', userActivityController.getGitHubActivity);


// Admin route to recalculate all users' activity data
router.post('/recalculate/all', userActivityController.recalculateAllUserActivity);

module.exports = router;
