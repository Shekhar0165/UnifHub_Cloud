const mongoose = require("mongoose");

const EventReviewSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Events",
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["approved", "pending", "rejected"],
        default: "pending"
    }
}, { timestamps: true });

// Compound index to ensure a user can only review an event once
EventReviewSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const EventReview = mongoose.model("EventReview", EventReviewSchema);

module.exports = EventReview; 