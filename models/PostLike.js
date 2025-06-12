const mongoose = require("mongoose"); 

const PostLikeSchema = new mongoose.Schema({
    postid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    likes:[
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ]
}, { timestamps: true });
const PostLike = mongoose.model("PostLike", PostLikeSchema);