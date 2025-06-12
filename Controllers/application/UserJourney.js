const Events = require('../../models/Events');
const Participant = require('../../models/Participants');
const UserJourney = require('../../models/UserJourney');
const Organization = require('../../models/Organization');
const User = require('../../models/User');

const buildUserJourney = async (userId) => {
    try {
        // Find the user first
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        let journey = await UserJourney.findOne({ userId });

        if (!journey) {
            // Create new journey if it doesn't exist
            journey = new UserJourney({
                userId: userId,
                currentOrganization: null,
                workHistory: [],
                Journey: [{
                    title: 'User Registered',
                    Date: user.createdAt,
                    description: `${user.name} joined the platform`,
                    achievementType: 'registration'
                }]
            });
            await journey.save();
        }

        // Check for first job
        if (journey.currentOrganization && !journey.Journey.some(j => j.title === 'First Job')) {
            journey.Journey.push({
                title: 'First Job',
                Date: journey.currentOrganization.startDate,
                description: `${user.name} started working at ${journey.currentOrganization.name} as ${journey.currentOrganization.role}`,
                achievementType: 'employment'
            });
            await journey.save();
        }

        // Check for job change milestones
        const jobChanges = journey.workHistory.length;
        if (jobChanges > 0 && !journey.Journey.some(j => j.title === 'Career Progression')) {
            journey.Journey.push({
                title: 'Career Progression',
                Date: new Date(),
                description: `${user.name} has worked in ${jobChanges + 1} organizations`,
                achievementType: 'employment',
                metrics: {
                    totalJobs: jobChanges + 1
                }
            });
            await journey.save();
        }

        // Check for performance feedback milestones
        const positiveFeedbackCount = journey.workHistory.filter(job => job.rating >= 4).length;
        const feedbackMilestones = [5, 10, 20];

        for (const milestone of feedbackMilestones) {
            if (positiveFeedbackCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Positive Feedback Milestone`)) {
                journey.Journey.push({
                    title: `${milestone} Positive Feedback Milestone`,
                    Date: new Date(),
                    description: `${user.name} has received ${milestone} positive feedback ratings!`,
                    achievementType: 'feedback',
                    metrics: {
                        positiveFeedback: milestone
                    }
                });
                await journey.save();
                break; // Only add the most recent milestone
            }
        }

        return journey;
    } catch (error) {
        console.error('Error in buildUserJourney:', error);
        throw new Error('Server error');
    }
};



const HandleGetUserJourney = async (req, res) => {
    try {
        const userId = req.params.userId;
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}