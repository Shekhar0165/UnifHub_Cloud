// models/Notification.js

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    notification: [
        {
            _id: {
                type: mongoose.Schema.Types.ObjectId,
                default: () => new mongoose.Types.ObjectId()
            },
            type: {
                type: String,
                required: true,
            },
            title: {
                type: String,
                required: true,
            },
            message: {
                type: String,
                required: true,
            },
            time: {
                type: Date,
                default: Date.now,
            },
            read: {
                type: Boolean,
                default: false,
            },
            avatar: {
                type: String,
                default: "👨‍💼",
            },
            icon: {
                type: String,
                default: "MessageSquare",
            },
            link: {
                type: String,
            }
        }
    ]

});

module.exports = mongoose.model("Notification", notificationSchema);
