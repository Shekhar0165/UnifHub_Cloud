const express = require('express');
const router = express.Router();
const {
    HandleShowFollowingListToUser,
    HandleGetMoreSuggestion
} = require('../../Controllers/application/FollowerSuggestion');
const auth = require('../../middleware/auth');


// Initialize S3 upload handler for organization files
router.get('/', auth, HandleShowFollowingListToUser);
router.get('/more', auth, HandleGetMoreSuggestion);

module.exports = router;