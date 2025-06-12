const OrganizationActivity = require('../../models/OrganizationActivity');
const Organization = require('../../models/Organizations');
const Event = require('../../models/Event');
const OrganizationReview = require('../../models/OrganizationReview');
const mongoose = require('mongoose');

// Scoring constants - can be adjusted as needed
const SCORE_CONSTANTS = {
    EVENT_CREATION_BASE: 50,
    REVIEW_RECEIVED_BASE: 5,
    REVIEW_SCORE_MULTIPLIER: 2, // Multiply by rating (1-5)
    PARTICIPANT_MULTIPLIER: 0.1, // 10 points per 100 participants
};

/**
 * Calculate organization activity scores
 * @param {String} organizationId - Organization ID
 */
const calculateOrganizationScore = async (organizationId) => {
    try {
        const objectId = new mongoose.Types.ObjectId(organizationId);
        
        // Find or create organization activity record
        let orgActivity = await OrganizationActivity.findOne({ organizationId: objectId });
        if (!orgActivity) {
            orgActivity = new OrganizationActivity({ organizationId: objectId });
        }

        // Reset scores for recalculation
        orgActivity.totalScore = 0;
        
        // 1. Calculate event creation scores
        const events = await Event.find({ organization_id: organizationId });

        orgActivity.eventCreation = [];
        
        for (const event of events) {
            // Calculate score based on event size
            const participantCount = event.totalparticipants || 0;
            const score = SCORE_CONSTANTS.EVENT_CREATION_BASE + 
                (participantCount * SCORE_CONSTANTS.PARTICIPANT_MULTIPLIER);
            
            orgActivity.eventCreation.push({
                eventId: event._id,
                eventName: event.eventName,
                date: event.eventDate,
                score: Math.round(score),
                participantCount
            });
            
            orgActivity.totalScore += Math.round(score);
        }
        
        // 2. Calculate review-based scores
        const reviews = await OrganizationReview.find({ 
            organizationId: objectId,
            status: "approved" 
        });
        
        orgActivity.reviews = [];
        
        for (const review of reviews) {
            const score = SCORE_CONSTANTS.REVIEW_RECEIVED_BASE + 
                (review.rating * SCORE_CONSTANTS.REVIEW_SCORE_MULTIPLIER);
            
            orgActivity.reviews.push({
                reviewId: review._id,
                rating: review.rating,
                date: review.createdAt,
                score: Math.round(score)
            });
            
            orgActivity.totalScore += Math.round(score);
        }
        
        // 3. Calculate time-based scores
        calculateTimeBasedScores(orgActivity);
        
        // 4. Update streak and contribution data
        updateStreakAndContributions(orgActivity);
        
        // Save the updated record
        await orgActivity.save();
        
        return orgActivity;
    } catch (error) {
        console.error('Error calculating organization scores:', error);
        throw error;
    }
};

/**
 * Calculate weekly and monthly scores
 * @param {Object} orgActivity - Organization activity record
 */
const calculateTimeBasedScores = (orgActivity) => {
    // Get all activity dates with scores
    const activityData = [];
    
    // Add event creation dates
    for (const event of orgActivity.eventCreation) {
        if (event.date) {
            activityData.push({
                date: new Date(event.date),
                score: event.score
            });
        }
    }
    
    // Add review dates
    for (const review of orgActivity.reviews) {
        if (review.date) {
            activityData.push({
                date: new Date(review.date),
                score: review.score
            });
        }
    }
    
    // Sort by date
    activityData.sort((a, b) => a.date - b.date);
    
    // Calculate weekly scores
    const weeklyScores = {};
    for (const activity of activityData) {
        const weekStart = getWeekStart(activity.date);
        const weekKey = weekStart.toISOString();
        
        if (!weeklyScores[weekKey]) {
            weeklyScores[weekKey] = {
                week: weekStart,
                score: 0
            };
        }
        
        weeklyScores[weekKey].score += activity.score;
    }
    
    // Calculate monthly scores
    const monthlyScores = {};
    for (const activity of activityData) {
        const monthStart = getMonthStart(activity.date);
        const monthKey = monthStart.toISOString();
        
        if (!monthlyScores[monthKey]) {
            monthlyScores[monthKey] = {
                month: monthStart,
                score: 0
            };
        }
        
        monthlyScores[monthKey].score += activity.score;
    }
    
    // Update the activity record
    orgActivity.weeklyScores = Object.values(weeklyScores);
    orgActivity.monthlyScores = Object.values(monthlyScores);
};

/**
 * Update streak and contribution data
 * @param {Object} orgActivity - Organization activity record
 */
const updateStreakAndContributions = (orgActivity) => {
    // Get all activity dates
    const activityDates = [];
    
    // Add event creation dates
    for (const event of orgActivity.eventCreation) {
        if (event.date) {
            activityDates.push(new Date(event.date));
        }
    }
    
    // Add review dates
    for (const review of orgActivity.reviews) {
        if (review.date) {
            activityDates.push(new Date(review.date));
        }
    }
    
    // Sort dates and convert to day-only format (YYYY-MM-DD)
    const sortedDates = activityDates
        .sort((a, b) => a - b)
        .map(date => new Date(date.toISOString().split('T')[0]));
    
    // Remove duplicates (multiple activities on same day)
    const uniqueDates = [...new Set(sortedDates.map(date => date.toISOString()))].map(dateStr => new Date(dateStr));
    
    // Calculate streak
    let currentStreak = 0;
    let longestStreak = 0;
    let lastActivityDate = null;
    
    if (uniqueDates.length > 0) {
        // Initialize streak with most recent activity
        lastActivityDate = uniqueDates[uniqueDates.length - 1];
        currentStreak = 1;
        longestStreak = 1;
        
        // Check consecutive days backwards from the most recent
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // If most recent activity is today, count streak backwards
        if (lastActivityDate.getTime() === today.getTime()) {
            for (let i = uniqueDates.length - 2; i >= 0; i--) {
                const currDate = uniqueDates[i];
                const prevDate = uniqueDates[i + 1];
                
                // Check if dates are consecutive days
                const dayDiff = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1) {
                    currentStreak++;
                    longestStreak = Math.max(longestStreak, currentStreak);
                } else if (dayDiff > 1) {
                    // Break in streak
                    break;
                }
            }
        } else {
            // Streak is broken if last activity is not today
            currentStreak = 0;
            
            // Still calculate longest streak in the past
            let tempStreak = 1;
            for (let i = uniqueDates.length - 2; i >= 0; i--) {
                const currDate = uniqueDates[i];
                const prevDate = uniqueDates[i + 1];
                
                const dayDiff = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1) {
                    tempStreak++;
                    longestStreak = Math.max(longestStreak, tempStreak);
                } else if (dayDiff > 1) {
                    tempStreak = 1;
                }
            }
        }
    }
    
    // Update streak data
    orgActivity.streak = {
        currentStreak,
        longestStreak,
        lastActivityDate
    };
    
    // Update contribution data (GitHub-style heatmap)
    const contributionData = Array(53).fill().map(() => Array(7).fill(0));
    
    // Group activities by date
    const activitiesByDate = {};
    
    // Count activities for event creation
    for (const event of orgActivity.eventCreation) {
        if (event.date) {
            const dateStr = new Date(event.date).toISOString().split('T')[0];
            if (!activitiesByDate[dateStr]) {
                activitiesByDate[dateStr] = 0;
            }
            activitiesByDate[dateStr] += 1;
        }
    }
    
    // Count activities for reviews
    for (const review of orgActivity.reviews) {
        if (review.date) {
            const dateStr = new Date(review.date).toISOString().split('T')[0];
            if (!activitiesByDate[dateStr]) {
                activitiesByDate[dateStr] = 0;
            }
            activitiesByDate[dateStr] += 1;
        }
    }
    
    // Fill in the contribution data
    for (const dateStr in activitiesByDate) {
        const date = new Date(dateStr);
        const weekNum = getWeekNumber(date);
        const dayOfWeek = date.getDay();
        
        if (weekNum >= 0 && weekNum < 53) {
            // Cap the contributions at 10 for display purposes
            contributionData[weekNum][dayOfWeek] = Math.min(activitiesByDate[dateStr], 10);
        }
    }
    
    orgActivity.contributionData = contributionData;
};

/**
 * Add score for a new event
 * @param {String} organizationId - Organization ID
 * @param {Object} event - Event object
 */
const addEventScore = async (organizationId, event) => {
    try {
        const objectId = new mongoose.Types.ObjectId(organizationId);
        
        // Find or create organization activity record
        let orgActivity = await OrganizationActivity.findOne({ organizationId: objectId });
        if (!orgActivity) {
            orgActivity = new OrganizationActivity({ organizationId: objectId });
        }
        
        // Calculate score for this event
        const participantCount = event.totalparticipants || 0;
        const score = SCORE_CONSTANTS.EVENT_CREATION_BASE + 
            (participantCount * SCORE_CONSTANTS.PARTICIPANT_MULTIPLIER);
        
        // Add to event creation list
        orgActivity.eventCreation.push({
            eventId: event._id,
            eventName: event.eventName,
            date: event.eventDate,
            score: Math.round(score),
            participantCount
        });
        
        // Update total score
        orgActivity.totalScore += Math.round(score);
        
        // Update time-based scores
        calculateTimeBasedScores(orgActivity);
        
        // Update streak and contribution data
        updateStreakAndContributions(orgActivity);
        
        // Save the updated record
        await orgActivity.save();
        
        return orgActivity;
    } catch (error) {
        console.error('Error adding event score:', error);
        throw error;
    }
};

/**
 * Add score for a new review
 * @param {String} organizationId - Organization ID
 * @param {Object} review - Review object
 */
const addReviewScore = async (organizationId, review) => {
    try {
        const objectId = new mongoose.Types.ObjectId(organizationId);
        
        // Only add score for approved reviews
        if (review.status !== "approved") {
            return null;
        }
        
        // Find or create organization activity record
        let orgActivity = await OrganizationActivity.findOne({ organizationId: objectId });
        if (!orgActivity) {
            orgActivity = new OrganizationActivity({ organizationId: objectId });
        }
        
        // Calculate score for this review
        const score = SCORE_CONSTANTS.REVIEW_RECEIVED_BASE + 
            (review.rating * SCORE_CONSTANTS.REVIEW_SCORE_MULTIPLIER);
        
        // Add to reviews list
        orgActivity.reviews.push({
            reviewId: review._id,
            rating: review.rating,
            date: review.createdAt,
            score: Math.round(score)
        });
        
        // Update total score
        orgActivity.totalScore += Math.round(score);
        
        // Update time-based scores
        calculateTimeBasedScores(orgActivity);
        
        // Update streak and contribution data
        updateStreakAndContributions(orgActivity);
        
        // Save the updated record
        await orgActivity.save();
        
        return orgActivity;
    } catch (error) {
        console.error('Error adding review score:', error);
        throw error;
    }
};

/**
 * Get the start of the week for a given date
 * @param {Date} date - Input date
 * @returns {Date} Date representing the start of the week
 */
const getWeekStart = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day); // Go to Sunday
    result.setHours(0, 0, 0, 0); // Set to start of day
    return result;
};

/**
 * Get the start of the month for a given date
 * @param {Date} date - Input date
 * @returns {Date} Date representing the start of the month
 */
const getMonthStart = (date) => {
    const result = new Date(date);
    result.setDate(1); // Go to first day of month
    result.setHours(0, 0, 0, 0); // Set to start of day
    return result;
};

/**
 * Get week number (0-52) for GitHub-style contribution graph
 * @param {Date} date - Input date
 * @returns {Number} Week number
 */
const getWeekNumber = (date) => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // For the contribution graph, we need weeks going back one year
    const weekMs = 7 * 24 * 60 * 60 * 1000; // milliseconds in a week
    const weeks = Math.floor((date - oneYearAgo) / weekMs);
    
    return Math.min(Math.max(weeks, 0), 52); // Clamp to 0-52 range
};

/**
 * Get organization activity and scores
 * @param {String} organizationId - Organization ID
 */
const HandleGetOrganizationActivity = async (req, res) => {
    try {
        const { organizationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
            return res.status(400).json({ message: "Invalid organization ID" });
        }
        
        // Find organization activity
        let orgActivity = await OrganizationActivity.findOne({ organizationId });
        
        // If no activity record exists, calculate it
        if (!orgActivity) {
            orgActivity = await calculateOrganizationScore(organizationId);
        }
        
        // Get organization details
        const organization = await Organization.findById(organizationId);
        
        res.status(200).json({
            organization: {
                _id: organization._id,
                name: organization.name,
                profileImage: organization.profileImage
            },
            activity: orgActivity
        });
    } catch (error) {
        console.error('Error getting organization activity:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/**
 * Recalculate organization activity scores
 * @param {String} organizationId - Organization ID
 */
const HandleRecalculateOrganizationActivity = async (req, res) => {
    try {
        const { organizationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
            return res.status(400).json({ message: "Invalid organization ID" });
        }
        
        // Recalculate scores
        const orgActivity = await calculateOrganizationScore(organizationId);
        
        res.status(200).json({
            message: "Organization activity recalculated successfully",
            activity: orgActivity
        });
    } catch (error) {
        console.error('Error recalculating organization activity:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/**
 * Get top organizations by score
 */
const HandleGetTopOrganizations = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        // Get top organizations by total score
        const topOrganizations = await OrganizationActivity.find()
            .sort({ totalScore: -1 })
            .limit(limit)
            .populate('organizationId', 'name profileImage');
        
        res.status(200).json(topOrganizations);
    } catch (error) {
        console.error('Error getting top organizations:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/**
 * Daily update for all organizations
 * To be called by a scheduled job
 */
const scheduleDailyOrganizationUpdate = async () => {
    try {
        // Get all organizations
        const organizations = await Organization.find();
        let count = 0;
        
        for (const org of organizations) {
            try {
                await calculateOrganizationScore(org._id);
                count++;
            } catch (error) {
                console.error(`Error updating organization ${org._id}:`, error);
            }
        }
        
        return { success: true, count };
    } catch (error) {
        console.error('Error in daily organization update:', error);
        return { success: false, error: error.message };
    }
};

// Hook into Events controller
// These functions should be called when events are created
// and when reviews are approved

module.exports = {
    calculateOrganizationScore,
    addEventScore,
    addReviewScore,
    HandleGetOrganizationActivity,
    HandleRecalculateOrganizationActivity,
    HandleGetTopOrganizations,
    scheduleDailyOrganizationUpdate
}; 