const express = require('express');
const router = express.Router();
const {
    HandleGetProfileForChat,
    handleGetOldChats,
    handleGetConversationLastMessage
} = require('../../Controllers/application/Chat');
const {
  HandleGetUserChatList,
  HandleSearchChats,
  HandleGetUnreadCount,
  HandleUpdateConversation
} = require('../../Controllers/application/ChatList')
const auth = require('../../middleware/auth');

// @route   POST api/chat/contact
router.get('/user/:userid',auth,HandleGetProfileForChat)
router.post('/get-messages',auth,handleGetOldChats)
router.get('/last-message',auth,handleGetConversationLastMessage)


router.get('/list',auth,HandleGetUserChatList)
router.get('/list/search',auth,HandleSearchChats)
router.get('/list/unread-count',auth,HandleGetUnreadCount)
router.put('/list/:conversationId',auth,HandleUpdateConversation)



module.exports = router;