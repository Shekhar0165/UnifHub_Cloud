const mongoose = require('mongoose');

const UserActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Total score based on all activities
    totalScore: {
        type: Number,
        default: 0
    },
    // Activities broken down by type
    eventParticipation: [{
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Events'
        },
        eventName: String,
        date: Date,
        score: Number,
        participantCount: Number,
        position: { // Added field to track event position
            type: mongoose.Schema.Types.Mixed, // Can be a number or string like 'participant'
            default: 'participant'
        }
    }],
    eventOrganization: [{
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Events'
        },
        eventName: String,
        role: String, // 'head', 'vice-head', 'member'
        date: Date,
        score: Number,
        participantCount: Number
    }],
    organizationMembership: [{
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization'
        },
        organizationName: String,
        role: String,
        teamName: String, // Added field to track which team they're part of
        joinDate: Date,
        score: Number
    }],
    // GitHub activity tracking
    githubActivity: {
        username: String,
        lastFetched: Date,
        totalContributions: {
            type: Number,
            default: 0
        },
        score: {
            type: Number,
            default: 0
        },
        repositories: [{
            name: String,
            url: String,
            stars: Number,
            forks: Number,
            commits: Number,
            score: Number
        }],
        contributions: [{
            type: String, // 'commit', 'issue', 'pull_request', 'code_review'
            repoName: String,
            title: String,
            url: String,
            date: Date,
            score: Number
        }],
        // GitHub contribution heatmap data (directly from GitHub)
        contributionCalendar: {
            totalContributions: Number,
            weeks: [{
                contributionDays: [{
                    date: String,
                    contributionCount: Number,
                    color: String
                }]
            }]
        }
    },
    // Daily activity scores
    dailyScores: [{ // Added new array for daily scores
        day: Date, // Start of the day
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
    // Current period scores (today, current week, current month, last month)
    currentScores: { // Added new object for easy access to current periods
        today: {
            type: Number,
            default: 0
        },
        currentWeek: {
            type: Number,
            default: 0
        },
        currentMonth: {
            type: Number,
            default: 0
        },
        lastMonth: {
            type: Number,
            default: 0
        }
    },
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
    // Last time the activity was updated
    lastUpdated: { // Added explicit field for tracking when scores were last updated
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('UserActivity', UserActivitySchema);