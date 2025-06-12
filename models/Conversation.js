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
    messages: [
        {
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            content: {
                type: String,
                required: true
            },
            timestamp: Date,
            unreadBy: [] 
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Conversation', ConversationSchema);