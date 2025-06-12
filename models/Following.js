const mongoose = require('mongoose');

const FollowSchema = new mongoose.Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    entityType: {  // Add entityType field to know if the follower is a user or organization
        type: String,
        enum: ['user', 'organization'],
        default: 'user'
    },
    list: [{
        followingid: {
            type: String
        },
        image_path: {
            type: String,
            required: true 
        },
        bio: {
            type: String,
            // required: true,
        },
        name: {
            type: String,
            require: true
        },
        userid: {
            type: String,
            require: true
        },
        entityType: {  // Add entityType field to know if the entity being followed is a user or organization
            type: String,
            enum: ['user', 'organization'],
            default: 'user'
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('following', FollowSchema);