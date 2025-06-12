const mongoose = require("mongoose");

const OrganizationReviewSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
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

// Compound index to ensure a user can only review an organization once
OrganizationReviewSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

const OrganizationReview = mongoose.model("OrganizationReview", OrganizationReviewSchema);

module.exports = OrganizationReview; 