const User = require("../../models/User");
const Organization = require('../../models/Organizations');
const Conversation = require("../../models/Conversation");
const { v4: uuidv4 } = require('uuid');

const HandleMakeConnection = (socket, io, client) => {
  socket.on('user-connected', async (userId) => {
    await client.hSet('online_users', userId, socket.id);
    socket.join('mainRoom');
    socket.join(userId); // Join user-specific room for notifications
    // Notify user they're connected
    socket.emit('user-status', { status: 'connected', userId });
  });
}

const HandleEnterChat = (socket, io, client) => {
  socket.on('enter-chat', async ({ userId, chatWith }) => {
    await client.hSet('user_active_chats', userId, chatWith);
    
    // Mark all messages as read when user enters chat
    try {
      const participants = [
        { id: userId, type: await getUserType(userId) },
        { id: chatWith, type: await getUserType(chatWith) }
      ];

      const conversation = await Conversation.findOne({
        participants: { $all: participants.map(p => ({ $elemMatch: p })) }
      });

      if (conversation) {
        await markAllMessagesAsRead(conversation._id.toString(), userId, client, io);
      }
    } catch (err) {
      console.error('Error marking messages as read on enter chat:', err);
    }
  });

  socket.on('leave-chat', async ({ userId }) => {
    await client.hDel('user_active_chats', userId);
  });
}

const flushTimers = {};

const HandlePrivateMessage = (socket, io, client) => {
  socket.on('privateMessage', async ({ to, message, from, timestamp }) => {
    try {
      // Identify user type
      const participants = [
        { id: from, type: await getUserType(from) },
        { id: to, type: await getUserType(to) }
      ];

      // Get or create the conversation
      let conversation = await Conversation.findOne({
        participants: { $all: participants.map(p => ({ $elemMatch: p })) }
      });

      if (!conversation) {
        conversation = new Conversation({ 
          participants, 
          messages: [],
          unreadCount: [
            { userId: from, count: 0 },
            { userId: to, count: 0 }
          ]
        });
        await conversation.save();
      }

      const conversationId = conversation._id.toString();
      const messageTimestamp = new Date(timestamp || Date.now());

      // Prepare message - sender automatically reads their own message
      const msg = {
        id: uuidv4(),
        sender: from,
        content: message,
        timestamp: messageTimestamp,
        readBy: [{ // Sender automatically reads their own message
          userId: from,
          readAt: messageTimestamp
        }],
        status: 'sent'
      };

      // Push message to Redis list
      await client.lPush(`chat_buffer:${conversationId}`, JSON.stringify(msg));

      // Update last message and increment unread count for recipient
      const lastMessageData = {
        content: message,
        sender: from,
        timestamp: messageTimestamp,
        status: 'sent'
      };

      // Increment unread count for recipient only
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: lastMessageData,
        $inc: { 'unreadCount.$[elem].count': 1 }
      }, {
        arrayFilters: [{ 'elem.userId': to }],
        upsert: false
      });

      // Set up flush timer if not already set
      if (!flushTimers[conversationId]) {
        flushTimers[conversationId] = setTimeout(async () => {
          try {
            const rawMessages = await client.lRange(`chat_buffer:${conversationId}`, 0, -1);
            const messages = rawMessages.map(m => JSON.parse(m)).reverse(); // Reverse to maintain chronological order

            await Conversation.findByIdAndUpdate(conversationId, {
              $push: { messages: { $each: messages } }
            });

            await client.del(`chat_buffer:${conversationId}`);
            delete flushTimers[conversationId];
          } catch (err) {
            console.error("Flush to DB failed:", err);
          }
        }, 5000);
      }

      // Get sender info
      const user = await User.findById(from).select('name profileImage userid') ||
                   await Organization.findById(from).select('name profileImage userid');

      const messageData = {
        from: user,
        message: msg.content,
        timestamp: msg.timestamp,
        id: msg.id,
        conversationId: conversationId,
        status: msg.status
      };

      // Check if recipient is in active chat
      const recipientActiveChat = await client.hGet('user_active_chats', to);
      const isInActiveChat = recipientActiveChat === from;

      

      io.to(to).emit('last-seen', messageData);
      if (isInActiveChat) {
        // User is actively viewing this chat
        io.to(to).emit('privateMessage', messageData);
        
        // Auto-mark as read since user is actively viewing
        setTimeout(async () => {
          try {
            await markSpecificMessageAsRead(conversationId, msg.id, to, client, io);
          } catch (err) {
            console.error('Auto-mark as read failed:', err);
          }
        }, 1000);
      } else {
        // User is not actively viewing this chat
        io.to(to).emit('messageNotification', {
          ...messageData,
          type: 'new_message',
          fromUser: from
        });
      }

      socket.emit('messageSent', messageData);
    } catch (err) {
      console.error('privateMessage error:', err);
      socket.emit('error', { message: 'Message failed to send' });
    }
  });

  // Handle message read events
  socket.on('markMessageRead', async ({ conversationId, messageId, userId }) => {
    try {
      await markSpecificMessageAsRead(conversationId, messageId, userId, client, io);
    } catch (err) {
      console.error('Mark message read error:', err);
    }
  });

  // Handle marking all messages as read
  socket.on('markAllMessagesRead', async ({ conversationId, userId }) => {
    try {
      await markAllMessagesAsRead(conversationId, userId, client, io);
    } catch (err) {
      console.error('Mark all messages read error:', err);
    }
  });
};

// Helper function to mark a specific message as read
const markSpecificMessageAsRead = async (conversationId, messageId, userId, client, io) => {
  let messageFound = false;

  // First check if message is in Redis buffer
  const rawMessages = await client.lRange(`chat_buffer:${conversationId}`, 0, -1);
  
  if (rawMessages.length > 0) {
    const messages = rawMessages.map(m => JSON.parse(m));
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex !== -1) {
      const message = messages[messageIndex];
      const alreadyRead = message.readBy.some(r => r.userId.toString() === userId.toString());
      
      if (!alreadyRead && message.sender.toString() !== userId.toString()) {
        message.readBy.push({
          userId: userId,
          readAt: new Date()
        });
        message.status = 'read';
        
        // Update in Redis
        await client.lSet(`chat_buffer:${conversationId}`, messageIndex, JSON.stringify(message));
        messageFound = true;
      }
    }
  }

  // If not found in Redis, check database
  if (!messageFound) {
    const result = await Conversation.findOneAndUpdate(
      { 
        _id: conversationId,
        'messages.id': messageId,
        'messages.sender': { $ne: userId }, // Don't mark own messages
        'messages.readBy.userId': { $ne: userId } // Not already read
      },
      {
        $push: { 'messages.$.readBy': { userId: userId, readAt: new Date() } },
        $set: { 'messages.$.status': 'read' }
      },
      { new: true }
    );

    if (result) {
      messageFound = true;
    }
  }

  if (messageFound) {
    // Reset unread count for this user
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { 'unreadCount.$[elem].count': 0 }
    }, {
      arrayFilters: [{ 'elem.userId': userId }]
    });

    // Emit read receipt to sender
    const conversation = await Conversation.findById(conversationId);
    const otherParticipant = conversation.participants.find(p => p.id.toString() !== userId.toString());
    
    if (otherParticipant) {
      io.to(otherParticipant.id.toString()).emit('messageRead', {
        messageId: messageId,
        readBy: userId,
        conversationId: conversationId,
        timestamp: new Date()
      });
    }
  }
};

// Helper function to mark all messages as read when user enters chat
const markAllMessagesAsRead = async (conversationId, userId, client, io) => {
  // Mark messages in Redis buffer as read
  const rawMessages = await client.lRange(`chat_buffer:${conversationId}`, 0, -1);
  
  if (rawMessages.length > 0) {
    const messages = rawMessages.map(m => JSON.parse(m));
    let updated = false;

    messages.forEach((message, index) => {
      const alreadyRead = message.readBy.some(r => r.userId.toString() === userId.toString());
      
      if (!alreadyRead && message.sender.toString() !== userId.toString()) {
        message.readBy.push({
          userId: userId,
          readAt: new Date()
        });
        message.status = 'read';
        updated = true;
      }
    });

    if (updated) {
      // Update all messages in Redis
      await client.del(`chat_buffer:${conversationId}`);
      const pipeline = client.multi();
      messages.reverse().forEach(msg => {
        pipeline.lPush(`chat_buffer:${conversationId}`, JSON.stringify(msg));
      });
      await pipeline.exec();
    }
  }

  // Mark messages in database as read
  const conversation = await Conversation.findById(conversationId);
  if (conversation) {
    // Update messages that haven't been read by this user
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $push: {
          'messages.$[elem].readBy': { userId: userId, readAt: new Date() }
        },
        $set: {
          'messages.$[elem].status': 'read',
          'unreadCount.$[userElem].count': 0
        }
      },
      {
        arrayFilters: [
          { 
            $and: [
              { 'elem.sender': { $ne: userId } },
              { 'elem.readBy.userId': { $ne: userId } }
            ]
          },
          { 'userElem.userId': userId }
        ]
      }
    );

    // Emit read receipts to other participants
    const otherParticipant = conversation.participants.find(p => p.id.toString() !== userId.toString());
    
    if (otherParticipant) {
      io.to(otherParticipant.id.toString()).emit('allMessagesRead', {
        readBy: userId,
        conversationId: conversationId,
        timestamp: new Date()
      });
    }
  }
};

// Helper: Identify if user is from User or Organization model
const getUserType = async (id) => {
  if (await User.exists({ _id: id })) return 'user';
  if (await Organization.exists({ _id: id })) return 'organization';
  return null;
};

const HandleDisconnect = (socket, io, client) => {
  socket.on('user-disconnect', async (userid) => {
    console.log(`User disconnecting: ${userid}`);
    if (userid) {
      await client.hDel('online_users', userid);
      await client.hDel('user_active_chats', userid);
      socket.leave(userid);
    }
  });

  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const allUsers = await client.hGetAll('online_users');
    for (const [userId, socketId] of Object.entries(allUsers)) {
      if (socketId === socket.id) {
        await client.hDel('online_users', userId);
        await client.hDel('user_active_chats', userId);
        console.log(`Removed disconnected user ${userId}`);
        break;
      }
    }
  });
}

const HandleGetProfileForChat = async (req, res) => {
  try {
    const id = req.params.userid;
    console.log(id)

    let user = await User.findOne({ userid: id }).select('-password -refreshToken -otp');

    if (!user) {
      user = await Organization.findOne({ userid: id }).select('-password -refreshToken -otp');
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const handleGetOldChats = async (req, res) => {
  const { userId, recipientId } = req.body;

  if (!userId || !recipientId) {
    return res.status(400).json({ error: "Missing userId or recipientId" });
  }

  try {
    const conversation = await Conversation.findOne({
      $and: [
        { "participants.id": userId },
        { "participants.id": recipientId }
      ]
    });
    
    console.log(conversation);
    
    if (!conversation) {
      return res.status(404).json({ error: "No conversation found" });
    }

    // Also return conversation ID and unread count for this user
    const userUnreadCount = conversation.unreadCount.find(uc => uc.userId.toString() === userId.toString());
    
    res.status(200).json({
      messages: conversation.messages,
      conversationId: conversation._id,
      unreadCount: userUnreadCount ? userUnreadCount.count : 0,
      lastMessage: conversation.lastMessage
    });
  } catch (error) {
    console.error("Error getting chats:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
};

// New endpoint to get conversation list with unread counts
const handleGetConversationLastMessage = async (req, res) => {
  const userId = req.user.id;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const conversations = await Conversation.find({
      "participants.id": userId
    })
    .sort({ updatedAt: -1 })
    .populate('participants.id', 'name profileImage userid')
    .select('participants lastMessage unreadCount updatedAt');

    const formattedConversations = await Promise.all(conversations.map(async (conv) => {
      const otherParticipant = conv.participants.find(p => p.id._id.toString() !== userId.toString());
      const userUnreadCount = conv.unreadCount.find(uc => uc.userId.toString() === userId.toString());

      return {
        conversationId: conv._id,
        participant: otherParticipant.id,
        lastMessage: conv.lastMessage,
        unreadCount: userUnreadCount ? userUnreadCount.count : 0,
        updatedAt: conv.updatedAt
      };
    }));

    res.status(200).json(formattedConversations);
  } catch (error) {
    console.error("Error getting conversation list:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
};



module.exports = {
  HandleMakeConnection,
  HandleEnterChat,
  HandlePrivateMessage,
  HandleDisconnect,
  HandleGetProfileForChat,
  handleGetOldChats,
  handleGetConversationLastMessage
}