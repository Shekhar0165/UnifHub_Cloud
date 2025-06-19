const Notification = require('../../models/Notification');
const Organization = require('../../models/Organizations');
const { listenerCount } = require('../../models/Organizations');
const User = require('../../models/User');
const UserSettings = require('../../models/UserSettings')

let globalSocket, globalIo, globalClient;

const HandlePushNotification = (socket, io, client) => {
    globalSocket = socket;
    globalIo = io;
    globalClient = client;
};

const HandleSendLikeNotifiction = async (userId, post, req) => {

    const usersettings = await UserSettings.findOne({ userId: userId });

    if (!usersettings) {
        const defaultSettings = {
            notifications: {
                likes: true,
                comments: true,
                follows: true,
                messages: true,
                posts: true,
            },
            privateAccount: true,
            showOnlineStatus: true
        };

        await UserSettings.create({ userId: user._id, ...defaultSettings });
    }

    if (!usersettings.notifications.likes) {
        console.log("do not send notifcaiton", userId)
        return
    }
    const recipientActiveChat = await globalClient.hGet('online_users', userId.toString());
    let user = await User.findById(req.user.id);
    const PostUser = await User.findById(userId)

    console.log("linke post ")

    if (!user) {
        user = await Organization.findById(req.user.id)
    }

    if (!user || !PostUser) {
        console.error("User Not Found");
        return;
    }

    const content = `${user.name} liked your post '${post.content.slice(0, 30)}...'`;

    const notificationItem = {
        type: 'like',
        title: 'New Like',
        message: content,
        time: new Date(),
        read: false,
        avatar: '👩‍💻',
        icon: "Heart",
        link: `/user/${PostUser.userid}/post/${post._id}`
    };

    // Save notification in DB
    let notificationDoc = await Notification.findOne({ userid: userId });

    if (!notificationDoc) {
        // Create new notification doc for this user
        notificationDoc = new Notification({
            userid: userId,
            notification: [notificationItem]
        });

        const savedDoc = await notificationDoc.save();
        // Get the ID of the first (and only) notification in the array
        const savedNotificationId = savedDoc.notification[0]._id;

        // Add the ID to the notification item before emitting
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        // Emit to user if online
        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }

    } else {
        // Push into existing notification array
        notificationDoc.notification.push(notificationItem);
        const savedDoc = await notificationDoc.save();

        // Get the ID of the last notification (the one we just added)
        const lastIndex = savedDoc.notification.length - 1;
        const savedNotificationId = savedDoc.notification[lastIndex]._id;

        // Add the ID to the notification item before emitting
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        // Emit to user if online
        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }
    }

    console.log("Notification saved and emitted with ID");
};

const HandleSendMessageNotification = async (to, messageData, fromUser) => {
    console.log('to:', to, "messageData:", messageData, "fromUser:", fromUser)
    const usersettings = await UserSettings.findOne({ userId: to });

    if (!usersettings) {
        const defaultSettings = {
            notifications: {
                likes: true,
                comments: true,
                follows: true,
                messages: true,
                posts: true,
            },
            privateAccount: true,
            showOnlineStatus: true
        };

        await UserSettings.create({ userId: to, ...defaultSettings });
    }

    if (!usersettings.notifications.messages) {
        console.log("do not send notifcaiton", to)
        return
    }
    const recipientActiveChat = await globalClient.hGet('online_users', to);
    const preview = messageData.message.length > 30 ? `${messageData.message.slice(0, 30)}...` : messageData.message;
    const content = `${messageData.from.name} sent you a message: "${preview}"`;

    const notificationItem = {
        type: 'message',
        title: 'New Message',
        message: content,
        time: new Date(),
        read: false,
        avatar: '👩‍💻',
        icon: "MessageCircle",
        link: `/messages?tab=/${messageData.from.userid}`
    };

    // Save notification in DB
    let notificationDoc = await Notification.findOne({ userid: to });

    if (!notificationDoc) {
        // Create new notification doc for this user
        notificationDoc = new Notification({
            userid: to,
            notification: [notificationItem]
        });

        const savedDoc = await notificationDoc.save();
        // Get the ID of the first (and only) notification in the array
        const savedNotificationId = savedDoc.notification[0]._id;

        // Add the ID to the notification item before emitting
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        // Emit to user if online
        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
            globalIo.to(to).emit('messageNotification', {
                ...messageData,
                type: 'new_message',
                fromUser: fromUser
            });
        }

    } else {
        // Push into existing notification array
        notificationDoc.notification.push(notificationItem);
        const savedDoc = await notificationDoc.save();

        // Get the ID of the last notification (the one we just added)
        const lastIndex = savedDoc.notification.length - 1;
        const savedNotificationId = savedDoc.notification[lastIndex]._id;

        // Add the ID to the notification item before emitting
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        // Emit to user if online
        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
            globalIo.to(to).emit('messageNotification', {
                ...messageData,
                type: 'new_message',
                fromUser: fromUser
            });
        }
    }
}


const HandleSendCommentNotification = async (userId, post, req) => {

    const usersettings = await UserSettings.findOne({ userId: userId });

    if (!usersettings) {
        const defaultSettings = {
            notifications: {
                likes: true,
                comments: true,
                follows: true,
                messages: true,
                posts: true,
            },
            privateAccount: true,
            showOnlineStatus: true
        };

        await UserSettings.create({ userId: user._id, ...defaultSettings });
    }

    if (!usersettings.notifications.comments) {
        console.log("do not send notifcaiton", userId)
        return
    }


    const recipientActiveChat = await globalClient.hGet('online_users', userId.toString());
    let user = await User.findById(req.user.id);
    const PostUser = await User.findById(userId)
    if (!user) {
        user = await Organization.findById(req.user.id)
    }

    if (!user || !PostUser) {
        console.error("User Not Found");
        return;
    }

    const notificationItem = {
        type: 'comment',
        title: 'New Comment',
        message: `${user.name} commented on your post: '${post.content.slice(0, 30)}...'`,
        time: new Date(),
        read: false,
        avatar: '👨‍💼',
        icon: "MessageSquare",
        link: `/user/${PostUser.userid}/post/${post._id}`
    };

    // Save comment notification in DB
    let notificationDoc = await Notification.findOne({ userid: userId });

    if (!notificationDoc) {
        // Create a new notification document
        notificationDoc = new Notification({
            userid: userId,
            notification: [notificationItem]
        });

        const savedDoc = await notificationDoc.save();
        const savedNotificationId = savedDoc.notification[0]._id;

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }

    } else {
        // Push into existing array
        notificationDoc.notification.push(notificationItem);
        const savedDoc = await notificationDoc.save();

        const lastIndex = savedDoc.notification.length - 1;
        const savedNotificationId = savedDoc.notification[lastIndex]._id;

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }
    }

    console.log("Comment notification saved and emitted with ID");
};


const HandleSendJoinNotification = async (user, type) => {
    console.log(user)
    const recipientActiveChat = await globalClient.hGet('online_users', user._id.toString());
    const notificationItem = {
        type: 'Join',
        title: "Joined UnifHub",
        message: `${user.name} joined UnifHub and started their journey.`,
        time: new Date(),
        read: false,
        avatar: '👨‍💼',
        icon: "UserPlus",
        link: `/${type}/${user.userid}`
    };


    // Save comment notification in DB
    let notificationDoc = await Notification.findOne({ userid: user._id });

    if (!notificationDoc) {
        // Create a new notification document
        notificationDoc = new Notification({
            userid: user._id.toString(),
            notification: [notificationItem]
        });

        const savedDoc = await notificationDoc.save();
        const savedNotificationId = savedDoc.notification[0]._id;

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }

    } else {
        // Push into existing array
        notificationDoc.notification.push(notificationItem);
        const savedDoc = await notificationDoc.save();

        const lastIndex = savedDoc.notification.length - 1;
        const savedNotificationId = savedDoc.notification[lastIndex]._id;

        console.log(savedNotificationId)

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }
    }
}

const handleSendNotificationtoParticipants = async (notificationItem, user) => {
    const recipientActiveChat = await globalClient.hGet('online_users', user.id.toString());
    let notificationDoc = await Notification.findOne({ userid: user.id });


    if (!notificationDoc) {
        console.log("working inside1")
        // Create a new notification document
        notificationDoc = new Notification({
            userid: user.id.toString(),
            notification: [notificationItem]
        });

        const savedDoc = await notificationDoc.save();
        const savedNotificationId = savedDoc.notification[0]._id;

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }

    } else {
        console.log("working inside1")
        // Push into existing array
        notificationDoc.notification.push(notificationItem);
        const savedDoc = await notificationDoc.save();

        const lastIndex = savedDoc.notification.length - 1;
        const savedNotificationId = savedDoc.notification[lastIndex]._id;

        console.log(savedNotificationId)

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }
    }
    console.log("comeplete")
}

const HandleSendNotificationOnPlatfrom = async (notificationItem, user) => {


    const Newtype = notificationItem.type;
    const usersettings = await UserSettings.findOne({ userId: user._id });
    if (!usersettings) {
        const defaultSettings = {
            notifications: {
                likes: true,
                comments: true,
                follows: true,
                messages: true,
                posts: true,
            },
            privateAccount: true,
            showOnlineStatus: true
        };

        await UserSettings.create({ userId: user._id, ...defaultSettings });
    }
    if (usersettings.notifications[Newtype] === false) {
        console.log("do not send notification", user._id)
        return;
    }

    const recipientActiveChat = await globalClient.hGet('online_users', user._id.toString());
    let notificationDoc = await Notification.findOne({ userid: user._id.toString() });

    if (!notificationDoc) {
        // Create a new notification document
        notificationDoc = new Notification({
            userid: user._id.toString(),
            notification: [notificationItem]
        });

        const savedDoc = await notificationDoc.save();
        const savedNotificationId = savedDoc.notification[0]._id;

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }
        console.log("Notification", notificationWithId)

    } else {
        // Push into existing array
        notificationDoc.notification.push(notificationItem);
        const savedDoc = await notificationDoc.save();

        const lastIndex = savedDoc.notification.length - 1;
        const savedNotificationId = savedDoc.notification[lastIndex]._id;

        console.log(savedNotificationId)

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }
        console.log("Notification", notificationWithId)
    }
}


// ✅ GET all notifications for a user
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const notifications = await Notification.findOne({ userid: userId });

        if (!notifications || !notifications.notification || notifications.notification.length === 0) {
            return res.status(200).json({
                notifications: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalNotifications: 0,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            });
        }

        // Reverse to get latest first
        const allNotifications = notifications.notification.reverse();
        const totalNotifications = allNotifications.length;
        const totalPages = Math.ceil(totalNotifications / limit);

        // Calculate pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedNotifications = allNotifications.slice(startIndex, endIndex);

        res.status(200).json({
            notifications: paginatedNotifications,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalNotifications: totalNotifications,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                limit: limit
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
// ✅ DELETE a specific notification by ID
const deleteNotification = async (req, res) => {
    try {
        const userId = req.user.id;
        const { notificationId } = req.params;
        console.log(notificationId)

        const result = await Notification.findOneAndUpdate(
            { userid: userId },
            { $pull: { notification: { _id: notificationId } } },
            { new: true }
        );

        console.log(result)

        if (!result) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.status(200).json({ message: 'Notification deleted', notifications: result.notification });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ✅ MARK a notification as read
const markNotificationRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { notificationId } = req.params;

        const notificationDoc = await Notification.findOne({ userid: userId });

        if (!notificationDoc) {
            return res.status(404).json({ error: 'Notification list not found' });
        }

        const notif = notificationDoc.notification.find(n => n.id === notificationId);

        if (!notif) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        notif.read = true;
        await notificationDoc.save();

        res.status(200).json({ message: 'Marked as read', notification: notif });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ✅ MARK ALL notifications as read
const markAllNotificationsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        const notificationDoc = await Notification.findOne({ userid: userId });

        if (!notificationDoc) {
            return res.status(404).json({ error: 'Notification list not found' });
        }

        notificationDoc.notification.forEach(notif => {
            notif.read = true;
        });

        await notificationDoc.save();

        res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


const DeleteAllNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the notification document for the user
        const notificationDoc = await Notification.findOne({ userid: userId });

        if (!notificationDoc) {
            return res.status(404).json({ error: 'Notification list not found' });
        }

        // Clear the notifications array
        notificationDoc.notification = [];

        // Save the updated document
        await notificationDoc.save();

        res.status(200).json({ message: 'All notifications deleted successfully' });
    } catch (error) {
        console.error('Error deleting all notifications:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};






module.exports = {
    HandlePushNotification,
    HandleSendLikeNotifiction,
    HandleSendCommentNotification,
    getNotifications,
    deleteNotification,
    markNotificationRead,
    markAllNotificationsRead,
    HandleSendJoinNotification,
    HandleSendNotificationOnPlatfrom,
    handleSendNotificationtoParticipants,
    DeleteAllNotifications,
    HandleSendMessageNotification
};
