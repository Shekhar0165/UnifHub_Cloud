const express = require('express')
const router = express.Router()
const {HandleAddFollower,HandleUnfollow,HandleCheckIsFollowed,HandleGetFollowerAndFollowingList} = require('../../Controllers/application/Follower');
const authenticateToken = require('../../middleware/auth');

router.post('/add',authenticateToken,HandleAddFollower);
router.post('/remove',authenticateToken,HandleUnfollow);
router.get('/checkfollower/:userid',authenticateToken,HandleCheckIsFollowed);
router.get('/list/:userid',authenticateToken,HandleGetFollowerAndFollowingList);


module.exports = router;