const mongoose = require('mongoose');

const OrganizationActivitySchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    // Total score based on all activities
    totalScore: {
        type: Number,
        default: 0
    },
    // Activities broken down by type
    eventCreation: [{
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Events'
        },
        eventName: String,
        date: Date,
        score: Number,
        participantCount: Number
    }],
    reviews: [{
        reviewId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrganizationReview'
        },
        rating: Number,
        date: Date,
        score: Number
    }],
    // Weekly activity scores
    weeklyScores: [{
        week: Date, // Start of the week
        score: Number
    }],
    // Monthly activity scores
    monthlyScores: [{
        month: Date, // Start of the month
        score: Number  
    }],
    // Activity streak data
    streak: {
        currentStreak: {
            type: Number,
            default: 0
        },
        longestStreak: {
            type: Number,
            default: 0
        },
        lastActivityDate: Date
    },
    // Contribution heatmap data (similar to GitHub)
    contributionData: {
        type: [[Number]],
        default: Array(53).fill().map(() => Array(7).fill(0)) // 53 weeks × 7 days
    },
    // Timestamps for creation and updates
}, { timestamps: true });

module.exports = mongoose.model('OrganizationActivity', OrganizationActivitySchema); 