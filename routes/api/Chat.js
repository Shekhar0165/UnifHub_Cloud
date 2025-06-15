const express = require('express');
const router = express.Router();
const {
    HandleGetProfileForChat,
    handleGetOldChats
} = require('../../Controllers/application/Chat');
const auth = require('../../middleware/auth');

// @route   POST api/chat/contact
router.get('/user/:userid',auth,HandleGetProfileForChat)
router.post('/get-messages',auth,handleGetOldChats)



module.exports = router;