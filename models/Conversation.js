const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    participants: [{
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        type: {
            type: String,
            enum: ['user', 'organization'],
            required: true
        }
    }],
    messages: [{
        id: {
            type: String,
            required: true,
            unique: true
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        messageType: {
            type: String,
            enum: ['text', 'image', 'file'],
            default: 'text'
        },
        fileData: {
            url: String,
            publicId: String,
            fileName: String,
            fileSize: Number,
            fileType: String
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        readBy: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
            },
            readAt: {
                type: Date,
                default: Date.now
            }
        }],
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        },
        // Message editing fields
        isEdited: {
            type: Boolean,
            default: false
        },
        editedAt: {
            type: Date
        },
        // Message deletion fields
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId
        },
        deletedFor: [{
            type: mongoose.Schema.Types.ObjectId
        }]
    }],
    lastMessage: {
        content: String,
        sender: mongoose.Schema.Types.ObjectId,
        timestamp: Date,
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        },
        messageType: {
            type: String,
            enum: ['text', 'image', 'file'],
            default: 'text'
        }
    },
    unreadCount: [{
        userId: mongoose.Schema.Types.ObjectId,
        count: {
            type: Number,
            default: 0
        }
    }],
    isPinned: {
        type: Boolean,
        default: false
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    mutedBy: [{
        userId: mongoose.Schema.Types.ObjectId,
        mutedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

// Add indexes for better performance
ConversationSchema.index({ "participants.id": 1, updatedAt: -1 });
ConversationSchema.index({ "lastMessage.timestamp": -1 });
ConversationSchema.index({ "unreadCount.userId": 1 });
ConversationSchema.index({ "messages.id": 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);