const mongoose = require("mongoose");

const UserResumeSchema = new mongoose.Schema({
    Journey: [{
        title: {
            type: String,
            required: true
        },
        Date: {
            type: Date,
            required: true,
        },
        description: {
            type: String,
            required: true
        },
        metrics: {
            type: Object,
            default: {}
        },
        isPosted: {
            type: Boolean,
            default: false
        }
    }],
    UserId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
}, { timestamps: true });

const UserResume = mongoose.model("UserResume", UserResumeSchema);

module.exports = UserResume;