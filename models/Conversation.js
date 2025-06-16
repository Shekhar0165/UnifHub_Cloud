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
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        content: {
            type: String,
            required: true
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
        // Status: sent, delivered, read
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        }
    }],
    lastMessage: {
        content: String,
        sender: mongoose.Schema.Types.ObjectId,
        timestamp: Date,
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        }
    },
    // Track unread count for each participant
    unreadCount: [{
        userId: mongoose.Schema.Types.ObjectId,
        count: {
            type: Number,
            default: 0
        }
    }],
    // Add these new fields for additional functionality
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

module.exports = mongoose.model('Conversation', ConversationSchema);