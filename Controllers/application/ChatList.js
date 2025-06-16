const mongoose = require('mongoose');
const User = require("../../models/User");
const Organization = require('../../models/Organizations');
const Conversation = require("../../models/Conversation");

const HandleGetUserChatList = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Use aggregation pipeline instead of populate for better control
        const conversations = await Conversation.aggregate([
            // Match conversations where user is a participant
            {
                $match: {
                    "participants.id": new mongoose.Types.ObjectId(userId)
                }
            },
            // Sort by most recent activity
            {
                $sort: {
                    updatedAt: -1,
                    "lastMessage.timestamp": -1
                }
            },
            // Skip and limit for pagination
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            // Lookup users
            {
                $lookup: {
                    from: 'users',
                    localField: 'participants.id',
                    foreignField: '_id',
                    as: 'userParticipants'
                }
            },
            // Lookup organizations
            {
                $lookup: {
                    from: 'organizations',
                    localField: 'participants.id',
                    foreignField: '_id',
                    as: 'orgParticipants'
                }
            },
            // Combine all participants
            {
                $addFields: {
                    allParticipants: {
                        $concatArrays: ['$userParticipants', '$orgParticipants']
                    }
                }
            }
        ]);

        // Get total count for pagination
        const totalConversations = await Conversation.countDocuments({
            "participants.id": new mongoose.Types.ObjectId(userId)
        });

        // Format the chat list
        const chatList = await Promise.all(conversations.map(async (conv) => {
            // Find the other participant (not the current user)
            const otherParticipant = conv.allParticipants.find(
                p => p._id.toString() !== userId.toString()
            );

            // Find participant type from original participants array
            const participantInfo = conv.participants.find(
                p => p.id.toString() === otherParticipant._id.toString()
            );

            // Get unread count for current user
            const userUnreadCount = conv.unreadCount?.find(
                uc => uc.userId.toString() === userId.toString()
            );

            // Check if other participant is online (from Redis)
            let isOnline = false;
            try {
                if (req.client) { // Assuming Redis client is passed in req
                    const onlineStatus = await req.client.hGet('online_users', otherParticipant._id.toString());
                    isOnline = !!onlineStatus;
                }
            } catch (err) {
                console.log('Error checking online status:', err);
            }

            // Get last seen info if available
            let lastSeen = null;
            if (!isOnline && otherParticipant.lastSeen) {
                lastSeen = otherParticipant.lastSeen;
            }

            return {
                conversationId: conv._id,
                participant: {
                    id: otherParticipant._id,
                    name: otherParticipant.name,
                    profileImage: otherParticipant.profileImage,
                    userid: otherParticipant.userid,
                    type: participantInfo?.type || (otherParticipant.email ? 'user' : 'organization'),
                    isOnline: isOnline,
                    lastSeen: lastSeen
                },
                lastMessage: {
                    content: conv.lastMessage?.content || '',
                    sender: conv.lastMessage?.sender || null,
                    timestamp: conv.lastMessage?.timestamp || conv.updatedAt,
                    status: conv.lastMessage?.status || 'sent'
                },
                unreadCount: userUnreadCount?.count || 0,
                isPinned: conv.isPinned || false,
                updatedAt: conv.updatedAt,
                createdAt: conv.createdAt
            };
        }));

        // Separate pinned and regular chats if needed
        const pinnedChats = chatList.filter(chat => chat.isPinned);
        const regularChats = chatList.filter(chat => !chat.isPinned);

        // Combine with pinned chats on top
        const sortedChatList = [...pinnedChats, ...regularChats];

        // Pagination info
        const pagination = {
            currentPage: page,
            totalPages: Math.ceil(totalConversations / limit),
            totalChats: totalConversations,
            hasNextPage: page < Math.ceil(totalConversations / limit),
            hasPrevPage: page > 1,
            nextPage: page < Math.ceil(totalConversations / limit) ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null
        };

        res.status(200).json({
            success: true,
            chats: sortedChatList,
            pagination
        });

    } catch (error) {
        console.error('Error fetching chat list:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch chat list',
            error: error.message
        });
    }
};

// Get chat list with search functionality
const HandleSearchChats = async (req, res) => {
    try {
        const userId = req.user.id;
        const searchQuery = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Build search pipeline
        const searchPipeline = [
            // Match conversations where user is participant
            {
                $match: {
                    "participants.id": new mongoose.Types.ObjectId(userId)
                }
            },
            // Lookup participant details
            {
                $lookup: {
                    from: 'users',
                    localField: 'participants.id',
                    foreignField: '_id',
                    as: 'userParticipants'
                }
            },
            {
                $lookup: {
                    from: 'organizations',
                    localField: 'participants.id',
                    foreignField: '_id',
                    as: 'orgParticipants'
                }
            },
            // Add combined participants field
            {
                $addFields: {
                    allParticipants: {
                        $concatArrays: ['$userParticipants', '$orgParticipants']
                    }
                }
            }
        ];

        // Add search filter if search query exists
        if (searchQuery.trim()) {
            searchPipeline.push({
                $match: {
                    $or: [
                        { 'allParticipants.name': { $regex: searchQuery, $options: 'i' } },
                        { 'allParticipants.userid': { $regex: searchQuery, $options: 'i' } },
                        { 'lastMessage.content': { $regex: searchQuery, $options: 'i' } }
                    ]
                }
            });
        }

        // Add sorting, pagination
        searchPipeline.push(
            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        );

        const conversations = await Conversation.aggregate(searchPipeline);

        // Format results similar to main chat list
        const searchResults = conversations.map(conv => {
            const otherParticipant = conv.allParticipants.find(
                p => p._id.toString() !== userId.toString()
            );

            const participantInfo = conv.participants.find(
                p => p.id.toString() === otherParticipant._id.toString()
            );

            const userUnreadCount = conv.unreadCount?.find(
                uc => uc.userId.toString() === userId.toString()
            );

            // Determine type from joined collections
            let participantType = 'unknown';
            if (conv.userParticipants.some(u => u._id.toString() === otherParticipant._id.toString())) {
                participantType = 'user';
            } else if (conv.orgParticipants.some(o => o._id.toString() === otherParticipant._id.toString())) {
                participantType = 'organization';
            }

            return {
                conversationId: conv._id,
                participant: {
                    id: otherParticipant._id,
                    name: otherParticipant.name,
                    profileImage: otherParticipant.profileImage,
                    userid: otherParticipant.userid,
                    type: participantType,
                    displayName: otherParticipant.name,
                    displayId: otherParticipant.userid
                },
                lastMessage: {
                    content: conv.lastMessage?.content || '',
                    sender: conv.lastMessage?.sender || null,
                    timestamp: conv.lastMessage?.timestamp || conv.updatedAt,
                    status: conv.lastMessage?.status || 'sent'
                },
                unreadCount: userUnreadCount?.count || 0,
                updatedAt: conv.updatedAt
            };
        });


        res.status(200).json({
            success: true,
            chats: searchResults,
            searchQuery: searchQuery,
            pagination: {
                currentPage: page,
                hasNextPage: searchResults.length === limit
            }
        });

    } catch (error) {
        console.error('Error searching chats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search chats',
            error: error.message
        });
    }
};

// Get unread messages count for user
const HandleGetUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await Conversation.aggregate([
            {
                $match: {
                    "participants.id": new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $unwind: "$unreadCount"
            },
            {
                $match: {
                    "unreadCount.userId": new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $group: {
                    _id: null,
                    totalUnread: { $sum: "$unreadCount.count" },
                    unreadChats: {
                        $sum: {
                            $cond: [{ $gt: ["$unreadCount.count", 0] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const unreadInfo = result[0] || { totalUnread: 0, unreadChats: 0 };

        res.status(200).json({
            success: true,
            totalUnreadMessages: unreadInfo.totalUnread,
            unreadChatsCount: unreadInfo.unreadChats
        });

    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: error.message
        });
    }
};

// Update conversation (pin/unpin, archive, etc.)
const HandleUpdateConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { action, value } = req.body; // action: 'pin', 'archive', etc.

        const updateData = {};
        switch (action) {
            case 'pin':
                updateData.isPinned = value;
                break;
            case 'archive':
                updateData.isArchived = value;
                break;
            case 'mute':
                updateData[`mutedBy.${userId}`] = value;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action'
                });
        }

        const conversation = await Conversation.findOneAndUpdate(
            {
                _id: conversationId,
                "participants.id": userId
            },
            updateData,
            { new: true }
        );

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Conversation ${action}ed successfully`,
            conversation
        });

    } catch (error) {
        console.error('Error updating conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update conversation',
            error: error.message
        });
    }
};



const HandleGetRealTimeChatList = async (socket, io, client) => {
  socket.on("check_user_status", async (userId) => {
    
    let isOnline = false;
    
    if (client) {
      const onlineStatus = await client.hGet('online_users', userId.toString());
      isOnline = !!onlineStatus;
    }
    
    // Emit to a user-specific event channel
    const statusEventName = `user_online_status_${userId}`;
    socket.emit(statusEventName, {
      userId,
      isOnline
    });
  });

 


};




module.exports = {
    HandleGetUserChatList,
    HandleSearchChats,
    HandleGetUnreadCount,
    HandleUpdateConversation,
    HandleGetRealTimeChatList
};