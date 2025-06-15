const User = require("../../models/User");
const Organization = require('../../models/Organizations');
const Conversation = require("../../models/Conversation");
const { v4: uuidv4 } = require('uuid');


const HandleMakeConnection = (socket,io,client)=>{
  socket.on('user-connected', async (userId) => {
        await client.hSet('online_users', userId, socket.id);
        socket.join('mainRoom');
        socket.join(userId); // Join user-specific room for notifications
        // Notify user they're connected
        socket.emit('user-status', { status: 'connected', userId });
    });
}

const HandleEnterChat = (socket,io,client)=>{
  socket.on('enter-chat', async ({ userId, chatWith }) => {
        await client.hSet('user_active_chats', userId, chatWith);
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
        conversation = new Conversation({ participants, messages: [] });
        await conversation.save(); // Save immediately to get the ID
      }

      const conversationId = conversation._id.toString();

      // Prepare message
      const msg = {
        id: uuidv4(),
        sender: from,
        content: message,
        timestamp: timestamp || new Date().toISOString(),
        unreadBy: [to]
      };

      // Push message to Redis list
      await client.lPush(`chat_buffer:${conversationId}`, JSON.stringify(msg));

      // Set up flush timer if not already set
      if (!flushTimers[conversationId]) {
        flushTimers[conversationId] = setTimeout(async () => {
          try {
            const rawMessages = await client.lRange(`chat_buffer:${conversationId}`, 0, -1);
            const messages = rawMessages.map(m => JSON.parse(m));

            await Conversation.findByIdAndUpdate(conversationId, {
              $push: { messages: { $each: messages } }
            });

            await client.del(`chat_buffer:${conversationId}`);
            delete flushTimers[conversationId];
          } catch (err) {
            console.error("Flush to DB failed:", err);
          }
        }, 5000); // 5 seconds
      }

      // Emit to both users
      const user = await User.findById(from).select('name profileImage userid') ||
                   await Organization.findById(from).select('name profileImage userid');

      const messageData = {
        from: user,
        message: msg.content,
        timestamp: msg.timestamp,
        id: msg.id
      };

      const recipientActiveChat = await client.hGet('user_active_chats', to);
      const isInActiveChat = recipientActiveChat === from;

      if (isInActiveChat) {
        io.to(to).emit('privateMessage', messageData);
      } else {
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
};


// Helper: Identify if user is from User or Organization model
const getUserType = async (id) => {
  if (await User.exists({ _id: id })) return 'user';
  if (await Organization.exists({ _id: id })) return 'organization';
  return null;
};

const HandleDisconnect = (socket,io,client)=>{
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
    const id = req.params.userid; // Authenticated user's ID'
    console.log(id)

    // Correct query to find user by ID
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
    console.log(conversation)
    if (!conversation) {
      return res.status(404).json({ error: "No conversation found" });
    }
    res.status(200).json(conversation.messages);
  } catch (error) {
    console.error("Error getting chats:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
};


module.exports = {
  HandleMakeConnection,
  HandleEnterChat,
  HandlePrivateMessage,
  HandleDisconnect,
  HandleGetProfileForChat,
  handleGetOldChats
}


