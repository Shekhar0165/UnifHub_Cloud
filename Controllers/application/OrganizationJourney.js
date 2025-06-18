const OrganizationJourney = require('../../models/OrganizationJourney');
const Organization = require('../../models/Organizations');
const User = require('../../models/User');
const Event = require('../../models/Event');
const Team = require('../../models/Teams');
const Participants = require('../../models/Participants');

// Import or define the notification function
const HandleSendNotificationOnPlatfrom = async (notificationItem, user) => {
    const recipientActiveChat = await globalClient.hGet('online_users', user._id.toString());
    let notificationDoc = await Notification.findOne({ userid: user._id });

    if (!notificationDoc) {
        // Create a new notification document
        notificationDoc = new Notification({
            userid: user._id.toString(),
            notification: [notificationItem]
        });

        const savedDoc = await notificationDoc.save();
        const savedNotificationId = savedDoc.notification[0]._id;

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }
        console.log("Notification", notificationWithId)

    } else {
        // Push into existing array
        notificationDoc.notification.push(notificationItem);
        const savedDoc = await notificationDoc.save();

        const lastIndex = savedDoc.notification.length - 1;
        const savedNotificationId = savedDoc.notification[lastIndex]._id;

        console.log(savedNotificationId)

        // Emit with _id
        const notificationWithId = {
            ...notificationItem,
            _id: savedNotificationId
        };

        if (recipientActiveChat) {
            globalIo.to(recipientActiveChat).emit("Notification", notificationWithId);
        }
        console.log("Notification", notificationWithId)
    }
};

// Helper function to send organization achievement notifications
const sendOrganizationAchievementNotification = async (orgId, achievementTitle, achievementDescription, achievementType = 'milestone') => {
    try {
        // Find the organization
        const org = await Organization.findById(orgId);
        if (!org) return;

        // Find the organization owner/admin
        const orgOwner = await User.findById(org.createdBy || org.owner || org.admin);
        if (!orgOwner) return;

        // Create notification based on achievement type
        let notificationTitle = `🏆 Organization Achievement!`;
        let notificationIcon = '🏆';
        let notificationAvatar = '🎯';

        if (achievementType === 'event_milestone') {
            if (achievementTitle.includes('First Event')) {
                notificationTitle = `🎉 First Event Created!`;
                notificationIcon = '🎯';
                notificationAvatar = '🎪';
            } else if (achievementTitle.includes('Events Milestone')) {
                notificationTitle = `🎪 Event Milestone Achieved!`;
                notificationIcon = '🎪';
                notificationAvatar = '🎯';
            }
        } else if (achievementType === 'participant_milestone') {
            if (achievementTitle.includes('First Team')) {
                notificationTitle = `👥 First Team Created!`;
                notificationIcon = '👥';
                notificationAvatar = '🤝';
            } else if (achievementTitle.includes('Participants Milestone')) {
                notificationTitle = `🎉 Participant Milestone!`;
                notificationIcon = '🎉';
                notificationAvatar = '👥';
            }
        } else if (achievementType === 'registration') {
            notificationTitle = `🎉 Welcome to UnifHub!`;
            notificationIcon = '🎉';
            notificationAvatar = '🌟';
        }

        const orgNotification = {
            type: 'congratulation',
            title: notificationTitle,
            message: `${org.name}: ${achievementDescription}`,
            time: new Date(),
            read: false,
            avatar: notificationAvatar,
            icon: "PartyPopper",
            link: `/organization/${org.userid || org._id}`
        };

        await HandleSendNotificationOnPlatfrom(orgNotification, orgOwner);
    } catch (error) {
        console.error('Error sending organization achievement notification:', error);
    }
};

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

            // Send notification for organization creation
            await sendOrganizationAchievementNotification(
                organizationId,
                'Organization Created',
                `${org.name} has successfully joined our platform!`,
                'registration'
            );
        }
        
        // Check for first event creation milestone
        const events = await Event.find({ organization_id: organizationId }).sort({ createdAt: 1 });
        const firstEvent = events[0];

        if (firstEvent && !journey.Journey.some(j => j.achievementType === 'event_milestone' && j.title === 'First Event Created')) {
            const achievementTitle = 'First Event Created';
            const achievementDescription = `${org.name} created their first event: ${firstEvent.eventName}`;
            
            journey.Journey.push({
                title: achievementTitle,
                Date: firstEvent.createdAt,
                description: achievementDescription,
                achievementType: 'event_milestone',
                metrics: {
                    eventCount: 1,
                    eventId: firstEvent._id
                }
            });
            await journey.save();

            // Send notification for first event creation
            await sendOrganizationAchievementNotification(
                organizationId,
                achievementTitle,
                achievementDescription,
                'event_milestone'
            );
        }

        // Check for event count milestones (5, 10, 25, 50, 100)
        const eventCount = events.length;
        const eventMilestones = [5, 10, 25, 50, 100];

        for (const milestone of eventMilestones) {
            if (eventCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Events Milestone`)) {
                const achievementTitle = `${milestone} Events Milestone`;
                const achievementDescription = `${org.name} has organized ${milestone} events!`;
                
                journey.Journey.push({
                    title: achievementTitle,
                    Date: new Date(),
                    description: achievementDescription,
                    achievementType: 'event_milestone',
                    metrics: {
                        eventCount: milestone
                    }
                });
                await journey.save();

                // Send notification for event milestone
                await sendOrganizationAchievementNotification(
                    organizationId,
                    achievementTitle,
                    achievementDescription,
                    'event_milestone'
                );
                break; // Only add the most recent milestone
            }
        }

        // Check for teams creation milestones
        const teams = await Team.find({ OrganizationId: org._id });

        if (teams.length > 0 && !journey.Journey.some(j => j.title === 'First Team Created')) {
            const firstTeam = teams.sort((a, b) => a.createdAt - b.createdAt)[0];
            const achievementTitle = 'First Team Created';
            const achievementDescription = `${org.name} created their first team: ${firstTeam.teamName}`;
            
            journey.Journey.push({
                title: achievementTitle,
                Date: firstTeam.createdAt,
                description: achievementDescription,
                achievementType: 'participant_milestone',
                metrics: {}
            });
            await journey.save();

            // Send notification for first team creation
            await sendOrganizationAchievementNotification(
                organizationId,
                achievementTitle,
                achievementDescription,
                'participant_milestone'
            );
        }

        // Check for participant milestones
        const participants = await Participants.find({ organization_id: org._id });
        const participantCount = participants.length;
        const participantMilestones = [10, 50, 100, 500, 1000];

        for (const milestone of participantMilestones) {
            if (participantCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Participants Milestone`)) {
                const achievementTitle = `${milestone} Participants Milestone`;
                const achievementDescription = `${org.name} has reached ${milestone} participants across all events!`;
                
                journey.Journey.push({
                    title: achievementTitle,
                    Date: new Date(),
                    description: achievementDescription,
                    achievementType: 'participant_milestone',
                    metrics: {
                        totalParticipants: milestone
                    }
                });
                await journey.save();

                // Send notification for participant milestone
                await sendOrganizationAchievementNotification(
                    organizationId,
                    achievementTitle,
                    achievementDescription,
                    'participant_milestone'
                );
                break; // Only add the most recent milestone
            }
        }

        updatedJourneys.push(journey);
    } catch (error) {
        console.error('Error in buildJourney:', error);
        throw error;
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

                // Send notification for organization creation
                await sendOrganizationAchievementNotification(
                    org._id,
                    'Organization Created',
                    `${org.name} has successfully joined our platform!`,
                    'registration'
                );
                continue;
            }

            // Check for first event creation milestone
            const events = await Event.find({ organization_id: org._id }).sort({ createdAt: 1 });
            const firstEvent = events[0];

            if (firstEvent && !journey.Journey.some(j => j.achievementType === 'event_milestone' && j.title === 'First Event Created')) {
                const achievementTitle = 'First Event Created';
                const achievementDescription = `${org.name} created their first event: ${firstEvent.eventName}`;
                
                journey.Journey.push({
                    title: achievementTitle,
                    Date: firstEvent.createdAt,
                    description: achievementDescription,
                    achievementType: 'event_milestone',
                    metrics: {
                        eventCount: 1,
                        eventId: firstEvent._id
                    }
                });
                await journey.save();

                // Send notification for first event creation
                await sendOrganizationAchievementNotification(
                    org._id,
                    achievementTitle,
                    achievementDescription,
                    'event_milestone'
                );
            }

            // Check for event count milestones (5, 10, 25, 50, 100)
            const eventCount = events.length;
            const eventMilestones = [5, 10, 25, 50, 100];

            for (const milestone of eventMilestones) {
                if (eventCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Events Milestone`)) {
                    const achievementTitle = `${milestone} Events Milestone`;
                    const achievementDescription = `${org.name} has organized ${milestone} events!`;
                    
                    journey.Journey.push({
                        title: achievementTitle,
                        Date: new Date(),
                        description: achievementDescription,
                        achievementType: 'event_milestone',
                        metrics: {
                            eventCount: milestone
                        }
                    });
                    await journey.save();

                    // Send notification for event milestone
                    await sendOrganizationAchievementNotification(
                        org._id,
                        achievementTitle,
                        achievementDescription,
                        'event_milestone'
                    );
                    break; // Only add the most recent milestone
                }
            }

            // Check for teams creation milestones
            const teams = await Team.find({ OrganizationId: org._id });

            if (teams.length > 0 && !journey.Journey.some(j => j.title === 'First Team Created')) {
                const firstTeam = teams.sort((a, b) => a.createdAt - b.createdAt)[0];
                const achievementTitle = 'First Team Created';
                const achievementDescription = `${org.name} created their first team: ${firstTeam.teamName}`;
                
                journey.Journey.push({
                    title: achievementTitle,
                    Date: firstTeam.createdAt,
                    description: achievementDescription,
                    achievementType: 'participant_milestone',
                    metrics: {}
                });
                await journey.save();

                // Send notification for first team creation
                await sendOrganizationAchievementNotification(
                    org._id,
                    achievementTitle,
                    achievementDescription,
                    'participant_milestone'
                );
            }

            // Check for participant milestones
            const participants = await Participants.find({ organization_id: org._id });
            const participantCount = participants.length;
            const participantMilestones = [10, 50, 100, 500, 1000];

            for (const milestone of participantMilestones) {
                if (participantCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Participants Milestone`)) {
                    const achievementTitle = `${milestone} Participants Milestone`;
                    const achievementDescription = `${org.name} has reached ${milestone} participants across all events!`;
                    
                    journey.Journey.push({
                        title: achievementTitle,
                        Date: new Date(),
                        description: achievementDescription,
                        achievementType: 'participant_milestone',
                        metrics: {
                            totalParticipants: milestone
                        }
                    });
                    await journey.save();

                    // Send notification for participant milestone
                    await sendOrganizationAchievementNotification(
                        org._id,
                        achievementTitle,
                        achievementDescription,
                        'participant_milestone'
                    );
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

                // Send notification for organization creation
                await sendOrganizationAchievementNotification(
                    org._id,
                    'Organization Created',
                    `${org.name} has successfully joined our platform!`,
                    'registration'
                );
                continue;
            }

            let updated = false;

            // Check for first event creation milestone
            const events = await Event.find({ organization_id: org._id }).sort({ createdAt: 1 });
            const firstEvent = events[0];

            if (firstEvent && !journey.Journey.some(j => j.achievementType === 'event_milestone' && j.title === 'First Event Created')) {
                const achievementTitle = 'First Event Created';
                const achievementDescription = `${org.name} created their first event: ${firstEvent.eventName}`;
                
                journey.Journey.push({
                    title: achievementTitle,
                    Date: firstEvent.createdAt,
                    description: achievementDescription,
                    achievementType: 'event_milestone',
                    metrics: {
                        eventCount: 1,
                        eventId: firstEvent._id
                    }
                });
                updated = true;

                // Send notification for first event creation
                await sendOrganizationAchievementNotification(
                    org._id,
                    achievementTitle,
                    achievementDescription,
                    'event_milestone'
                );
            }

            // Check for event count milestones (5, 10, 25, 50, 100)
            const eventCount = events.length;
            const eventMilestones = [5, 10, 25, 50, 100];

            for (const milestone of eventMilestones) {
                if (eventCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Events Milestone`)) {
                    const achievementTitle = `${milestone} Events Milestone`;
                    const achievementDescription = `${org.name} has organized ${milestone} events!`;
                    
                    journey.Journey.push({
                        title: achievementTitle,
                        Date: new Date(),
                        description: achievementDescription,
                        achievementType: 'event_milestone',
                        metrics: {
                            eventCount: milestone
                        }
                    });
                    updated = true;

                    // Send notification for event milestone
                    await sendOrganizationAchievementNotification(
                        org._id,
                        achievementTitle,
                        achievementDescription,
                        'event_milestone'
                    );
                    break; // Only add the most recent milestone
                }
            }

            // Check for teams creation milestones
            const teams = await Team.find({ OrganizationId: org._id });

            if (teams.length > 0 && !journey.Journey.some(j => j.title === 'First Team Created')) {
                const firstTeam = teams.sort((a, b) => a.createdAt - b.createdAt)[0];
                const achievementTitle = 'First Team Created';
                const achievementDescription = `${org.name} created their first team: ${firstTeam.teamName}`;
                
                journey.Journey.push({
                    title: achievementTitle,
                    Date: firstTeam.createdAt,
                    description: achievementDescription,
                    achievementType: 'participant_milestone',
                    metrics: {}
                });
                updated = true;

                // Send notification for first team creation
                await sendOrganizationAchievementNotification(
                    org._id,
                    achievementTitle,
                    achievementDescription,
                    'participant_milestone'
                );
            }

            // Check for participant milestones
            const participants = await Participants.find({ organization_id: org._id });
            const participantCount = participants.length;
            const participantMilestones = [10, 50, 100, 500, 1000];

            for (const milestone of participantMilestones) {
                if (participantCount >= milestone && !journey.Journey.some(j => j.title === `${milestone} Participants Milestone`)) {
                    const achievementTitle = `${milestone} Participants Milestone`;
                    const achievementDescription = `${org.name} has reached ${milestone} participants across all events!`;
                    
                    journey.Journey.push({
                        title: achievementTitle,
                        Date: new Date(),
                        description: achievementDescription,
                        achievementType: 'participant_milestone',
                        metrics: {
                            totalParticipants: milestone
                        }
                    });
                    updated = true;

                    // Send notification for participant milestone
                    await sendOrganizationAchievementNotification(
                        org._id,
                        achievementTitle,
                        achievementDescription,
                        'participant_milestone'
                    );
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

        const testTitle = title || 'Test Milestone';
        const testDescription = description || `Test milestone for ${organization.name}`;
        const testAchievementType = achievementType || 'event_milestone';

        // Add new milestone
        journey.Journey.push({
            title: testTitle,
            Date: new Date(),
            description: testDescription,
            achievementType: testAchievementType,
            metrics: metrics || {}
        });

        await journey.save();

        // Send test notification
        await sendOrganizationAchievementNotification(
            organizationId,
            testTitle,
            testDescription,
            testAchievementType
        );

        return res.status(200).json({
            success: true,
            message: 'Test milestone added successfully with notification sent',
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

            // Send notification for organization creation
            await sendOrganizationAchievementNotification(
                organizationId,
                'Organization Created',
                `${organization.name} has successfully joined our platform!`,
                'registration'
            );
        }

        // Try to populate the organization
        const populatedJourney = await OrganizationJourney.findOne({ OrganizationId: organizationId })
            .populate('OrganizationId');

        return res.status(200).json({
            success: true,
            message: 'Schema test completed successfully with notifications',
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
    testSchemaFix,
    sendOrganizationAchievementNotification
};