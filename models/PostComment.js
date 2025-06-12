const Post = require('./Post')
const Comment = require('./Comment')
const mongoose = require("mongoose");
const PostCommentSchema = new mongoose.Schema({
    postid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    comments:[
        {
            comment: {
                type: String,
                required: true
            },
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
const PostComment = mongoose.model("PostComment", PostCommentSchema);