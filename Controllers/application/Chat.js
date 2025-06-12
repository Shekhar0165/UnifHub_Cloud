const User = require("../../models/User");


const HandleContectUser = async (socket, io) => {
    socket.on('user', async (data) => {
        try {
            const user = await User.findById(data.userId);
            if (!user) {
                socket.emit('error', { message: 'User not found' });
                return;
            }
            socket.userId = data.userId;
            socket.join(data.userId); // Join user's own room for private messages
            socket.emit('connected', { message: 'Connected successfully' });
        } catch (error) {
            console.error('Connection error:', error);
            socket.emit('error', { message: 'Connection failed' });
        }
    });
}


const HandleJoinChat = async (socket, io) => {
    socket.on('join-chat', async (data) => {
        try {
            // Verify both users exist
            const [user1, user2] = await Promise.all([
                User.findById(data.userId),
                User.findById(data.recipientId)
            ]);

            if (!user1 || !user2) {
                socket.emit('error', { message: 'One or both users not found' });
                return;
            }

            // Sort IDs to ensure consistent room naming regardless of who initiates
            const participantIds = [data.userId, data.recipientId].sort();
            const roomId = `chat_${participantIds[0]}_${participantIds[1]}`;

            // Find or create conversation
            // let conversation = await Conversation.findOne({
            //     'participants.id': { $all: participantIds }
            // });

            // if (!conversation) {
            //     conversation = new Conversation({
            //         participants: [
            //             { id: participantIds[0], type: 'user' },
            //             { id: participantIds[1], type: 'user' }
            //         ]
            //     });
            //     await conversation.save();
            // }

            // socket.conversationId = conversation._id;
            socket.join(roomId);

            // Notify room join
            socket.emit('joined', {
                roomId,
                // conversationId: conversation._id,
                message: 'Joined chat room successfully'
            });
            console.log(`User ${data.userId} joined room ${roomId}`);

            // Handle messages
            socket.on('send-message', async (messageData) => {
                // const participantIds = [messageData.userId, messageData.recipientId].sort();
                // const roomId = `chat_${participantIds[0]}_${participantIds[1]}`;
                console.log("sendMessage", messageData);
                try {
                    const message = new Message({
                        // conversationId: conversation._id,
                        sender: messageData.senderId,
                        senderType: 'user',
                        content: messageData.content
                    });
                    // await message.save();

                    // Update conversation's last message
                    // conversation.lastMessage = message._id;
                    // await conversation.save();

                    // Emit to all users in the room
                    io.to(roomId).emit('new-message', {
                        message: message,
                        sender: messageData.senderId
                    });
                } catch (error) {
                    console.error('Message error:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

        } catch (error) {
            console.error('Join chat error:', error);
            socket.emit('error', { message: 'Failed to join chat' });
        }
    });
}

module.exports = {
    HandleContectUser,
    HandleJoinChat
}


