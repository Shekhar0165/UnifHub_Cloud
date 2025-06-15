const OrganizationJourney = require('../../models/OrganizationJourney');
const Organization = require('../../models/Organizations');
const User = require('../../models/User');
const Event = require('../../models/Event');
const Team = require('../../models/Teams');
const Participants = require('../../models/Participants');

const buildJourney = async (organizationId) => {
    try {
        // Find the organization first
        const org = await Organization.findById(organizationId);
        const updatedJourneys = [];
        if (!org) {
            throw new Error('Organization not found');
        }
        
        let journey = await OrganizationJourney.findOne({ OrganizationId: organizationId });
        if (!journey) {
            // Create new journey if it doesn't exist
            journey = new OrganizationJourney({
                OrganizationId: organizationId,
                Journey: [{
                    title: 'Organization Created',
                    Date: org.createdAt,
                    description: `${org.name} joined our platform`,
                    achievementType: 'registration',
                    metrics: {}
                }]
            });
            await journey.save();
        }
        
        // Check for first event creation milestone
        const events = await Event.find({ organization_id: organizationId }).sort({ createdAt: 1 });
        const firstEvent = events[0];

        if (firstEvent && !journey.Journey.some(j => j.achievementType === 'event_milestone' && j.title === 'First Event Created')) {
            journey.Journey.push({
                title: 'First Event Created',
                Date: firstEvent.createdAt,
                description: `${org.name} created their first event: ${firstEvent.eventName}`,
                achievementType: 'event_milestone',
                metrics: {
                    eventCount: 1,
                    eventId: firstEvent._id
                }
            });
            await journey.save();
        }

        // Check for event count milestones (5, 10, 25, 50, 100)
        const eventCount = events.length;
        const eventMilestones = [5, 10, 25, 50, 100];

        for (const milestone of eventMilestones) {
            if (eventCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Events Milestone`)) {
                journey.Journey.push({
                    title: `${milestone} Events Milestone`,
                    Date: new Date(),
                    description: `${org.name} has organized ${milestone} events!`,
                    achievementType: 'event_milestone',
                    metrics: {
                        eventCount: milestone
                    }
                });
                await journey.save();
                break; // Only add the most recent milestone
            }
        }

        // Check for teams creation milestones
        const teams = await Team.find({ OrganizationId: org._id });

        if (teams.length > 0 && !journey.Journey.some(j => j.title === 'First Team Created')) {
            const firstTeam = teams.sort((a, b) => a.createdAt - b.createdAt)[0];
            journey.Journey.push({
                title: 'First Team Created',
                Date: firstTeam.createdAt,
                description: `${org.name} created their first team: ${firstTeam.teamName}`,
                achievementType: 'participant_milestone',
                metrics: {}
            });
            await journey.save();
        }

        // Check for participant milestones
        const participants = await Participants.find({ organization_id: org._id });
        const participantCount = participants.length;
        const participantMilestones = [10, 50, 100, 500, 1000];

        for (const milestone of participantMilestones) {
            if (participantCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Participants Milestone`)) {
                journey.Journey.push({
                    title: `${milestone} Participants Milestone`,
                    Date: new Date(),
                    description: `${org.name} has reached ${milestone} participants across all events!`,
                    achievementType: 'participant_milestone',
                    metrics: {
                        totalParticipants: milestone
                    }
                });
                await journey.save();
                break; // Only add the most recent milestone
            }
        }

        updatedJourneys.push(journey);
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
}

// Get organization journey by organization ID
const getOrganizationJourney = async (req, res) => {
    try {
        const { organizationId } = req.params;
        
        try {
            await buildJourney(organizationId);
        } catch (error) {
            console.error('Error building journey:', error);
            return res.status(500).json({ success: false, message: 'Error building journey', error: error.message });
        }

        const journey = await OrganizationJourney.findOne({ OrganizationId: organizationId })
            .populate('OrganizationId', 'name email profileImage');

        if (!journey) {
            return res.status(404).json({ success: false, message: 'Organization journey not found' });
        }

        return res.status(200).json({ success: true, data: journey });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};



// Update organization journey for all organizations (to be run daily)
const updateOrganizationJourney = async (req, res) => {
    try {
        // Get all organizations
        const organizations = await Organization.find();
        const updatedJourneys = [];

        for (const org of organizations) {
            // Get existing journey or create new one
            let journey = await OrganizationJourney.findOne({ OrganizationId: org._id });

            if (!journey) {
                // Create new journey if it doesn't exist
                journey = new OrganizationJourney({
                    OrganizationId: org._id,
                    Journey: [{
                        title: 'Organization Created',
                        Date: org.createdAt,
                        description: `${org.name} joined our platform`,
                        achievementType: 'registration',
                        metrics: {}
                    }]
                });
                await journey.save();
                updatedJourneys.push(journey);
                continue;
            }

            // Check for first event creation milestone
            const events = await Event.find({ organization_id: org._id }).sort({ createdAt: 1 });
            const firstEvent = events[0];

            if (firstEvent && !journey.Journey.some(j => j.achievementType === 'event_milestone' && j.title === 'First Event Created')) {
                journey.Journey.push({
                    title: 'First Event Created',
                    Date: firstEvent.createdAt,
                    description: `${org.name} created their first event: ${firstEvent.eventName}`,
                    achievementType: 'event_milestone',
                    metrics: {
                        eventCount: 1,
                        eventId: firstEvent._id
                    }
                });
                await journey.save();
            }

            // Check for event count milestones (5, 10, 25, 50, 100)
            const eventCount = events.length;
            const eventMilestones = [5, 10, 25, 50, 100];

            for (const milestone of eventMilestones) {
                if (eventCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Events Milestone`)) {
                    journey.Journey.push({
                        title: `${milestone} Events Milestone`,
                        Date: new Date(),
                        description: `${org.name} has organized ${milestone} events!`,
                        achievementType: 'event_milestone',
                        metrics: {
                            eventCount: milestone
                        }
                    });
                    await journey.save();
                    break; // Only add the most recent milestone
                }
            }

            // Check for teams creation milestones
            const teams = await Team.find({ OrganizationId: org._id });

            if (teams.length > 0 && !journey.Journey.some(j => j.title === 'First Team Created')) {
                const firstTeam = teams.sort((a, b) => a.createdAt - b.createdAt)[0];
                journey.Journey.push({
                    title: 'First Team Created',
                    Date: firstTeam.createdAt,
                    description: `${org.name} created their first team: ${firstTeam.teamName}`,
                    achievementType: 'participant_milestone',
                    metrics: {}
                });
                await journey.save();
            }

            // Check for participant milestones
            const participants = await Participants.find({ organization_id: org._id });
            const participantCount = participants.length;
            const participantMilestones = [10, 50, 100, 500, 1000];

            for (const milestone of participantMilestones) {
                if (participantCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Participants Milestone`)) {
                    journey.Journey.push({
                        title: `${milestone} Participants Milestone`,
                        Date: new Date(),
                        description: `${org.name} has reached ${milestone} participants across all events!`,
                        achievementType: 'participant_milestone',
                        metrics: {
                            totalParticipants: milestone
                        }
                    });
                    await journey.save();
                    break; // Only add the most recent milestone
                }
            }

            updatedJourneys.push(journey);
        }

        return res.status(200).json({
            success: true,
            message: 'Organization journeys updated successfully',
            count: updatedJourneys.length
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Schedule daily update function (to be called by a cron job)
const scheduleDailyUpdate = async () => {
    try {
        const organizations = await Organization.find();
        let updateCount = 0;

        for (const org of organizations) {
            // Get existing journey or create new one
            let journey = await OrganizationJourney.findOne({ OrganizationId: org._id });

            if (!journey) {
                // Create new journey if it doesn't exist
                journey = new OrganizationJourney({
                    OrganizationId: org._id,
                    Journey: [{
                        title: 'Organization Created',
                        Date: org.createdAt,
                        description: `${org.name} joined our platform`,
                        achievementType: 'registration',
                        metrics: {}
                    }]
                });
                await journey.save();
                updateCount++;
                continue;
            }

            let updated = false;

            // Check for first event creation milestone
            const events = await Event.find({ organization_id: org._id }).sort({ createdAt: 1 });
            const firstEvent = events[0];

            if (firstEvent && !journey.Journey.some(j => j.achievementType === 'event_milestone' && j.title === 'First Event Created')) {
                journey.Journey.push({
                    title: 'First Event Created',
                    Date: firstEvent.createdAt,
                    description: `${org.name} created their first event: ${firstEvent.eventName}`,
                    achievementType: 'event_milestone',
                    metrics: {
                        eventCount: 1,
                        eventId: firstEvent._id
                    }
                });
                updated = true;
            }

            // Check for event count milestones (5, 10, 25, 50, 100)
            const eventCount = events.length;
            const eventMilestones = [5, 10, 25, 50, 100];

            for (const milestone of eventMilestones) {
                if (eventCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Events Milestone`)) {
                    journey.Journey.push({
                        title: `${milestone} Events Milestone`,
                        Date: new Date(),
                        description: `${org.name} has organized ${milestone} events!`,
                        achievementType: 'event_milestone',
                        metrics: {
                            eventCount: milestone
                        }
                    });
                    updated = true;
                    break; // Only add the most recent milestone
                }
            }

            // Check for teams creation milestones
            const teams = await Team.find({ OrganizationId: org._id });

            if (teams.length > 0 && !journey.Journey.some(j => j.title === 'First Team Created')) {
                const firstTeam = teams.sort((a, b) => a.createdAt - b.createdAt)[0];
                journey.Journey.push({
                    title: 'First Team Created',
                    Date: firstTeam.createdAt,
                    description: `${org.name} created their first team: ${firstTeam.teamName}`,
                    achievementType: 'participant_milestone',
                    metrics: {}
                });
                updated = true;
            }

            // Check for participant milestones
            const participants = await Participants.find({ organization_id: org._id });
            const participantCount = participants.length;
            const participantMilestones = [10, 50, 100, 500, 1000];

            for (const milestone of participantMilestones) {
                if (participantCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Participants Milestone`)) {
                    journey.Journey.push({
                        title: `${milestone} Participants Milestone`,
                        Date: new Date(),
                        description: `${org.name} has reached ${milestone} participants across all events!`,
                        achievementType: 'participant_milestone',
                        metrics: {
                            totalParticipants: milestone
                        }
                    });
                    updated = true;
                    break; // Only add the most recent milestone
                }
            }

            if (updated) {
                await journey.save();
                updateCount++;
            }
        }

        return { success: true, count: updateCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// Test function to add or update journey for a specific organization
const testAddJourneyMilestone = async (req, res) => {
    try {
        const { organizationId } = req.params;
        const { title, description, achievementType, metrics } = req.body;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required'
            });
        }

        // Check if organization exists
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Get or create journey
        let journey = await OrganizationJourney.findOne({ OrganizationId: organizationId });

        if (!journey) {
            // Create new journey
            journey = new OrganizationJourney({
                OrganizationId: organizationId,
                Journey: [{
                    title: 'Organization Created',
                    Date: organization.createdAt,
                    description: `${organization.name} joined our platform`,
                    achievementType: 'registration',
                    metrics: {}
                }]
            });
        }

        // Add new milestone
        journey.Journey.push({
            title: title || 'Test Milestone',
            Date: new Date(),
            description: description || `Test milestone for ${organization.name}`,
            achievementType: achievementType || 'event_milestone',
            metrics: metrics || {}
        });

        await journey.save();

        return res.status(200).json({
            success: true,
            message: 'Test milestone added successfully',
            journey
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Test function just to verify schema is working properly
const testSchemaFix = async (req, res) => {
    try {
        const { organizationId } = req.params;

        // First check if the organization exists
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Then check if an organization journey exists
        let journey = await OrganizationJourney.findOne({ OrganizationId: organizationId });

        if (!journey) {
            // Create one if it doesn't exist
            journey = new OrganizationJourney({
                OrganizationId: organizationId,
                Journey: [{
                    title: 'Organization Created',
                    Date: organization.createdAt,
                    description: `${organization.name} joined our platform`,
                    achievementType: 'registration',
                    metrics: {}
                }]
            });
            await journey.save();
        }

        // Try to populate the organization
        const populatedJourney = await OrganizationJourney.findOne({ OrganizationId: organizationId })
            .populate('OrganizationId');

        return res.status(200).json({
            success: true,
            message: 'Schema test completed successfully',
            organization,
            journey,
            populatedJourney
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    getOrganizationJourney,
    updateOrganizationJourney,
    scheduleDailyUpdate,
    testAddJourneyMilestone,
    testSchemaFix
};
