const User = require('../../models/User');
const Organization = require('../../models/Organizations');
const Event = require('../../models/Event');
const Participants = require('../../models/Participants');
const UserResume = require('../../models/UserResume');
const Team = require('../../models/Teams');

const HandleFindEvents = async (id, res) => {
    try {

        if (!id) {
            return res.status(400).send("Invalid Request");
        }

        // Find all events where the user is a participant
        const findUser = await Participants.find({
            "participant_id.id": id
        });

        if (!findUser.length) {
            return res.status(404).send("No events found for this user.");
        }

        let eventList = [];

        for (const user of findUser) {
            const { eventid, position, certificate_path } = user;

            const event = await Event.findById(eventid);
            if (!event) {
                continue; // Skip if event not found
            }

            if (event.status !== "completed") {
                continue; // Skip if event is not completed
            }

            eventList.push({
                title: event.eventName,
                event_date: event.eventDate,
                position: position,
                certificate_path: certificate_path ? certificate_path : "No Certificate",
            });
        }

        if (eventList.length === 0) {
            return res.status(200).send("You have not completed any events.");
        }

        res.send(eventList);

    } catch (err) {
        res.status(500).send("Internal Server Problem");
    }
};

// This function checks events completed by a user and updates their resume
const HandleCheckEventsCompleted = async (userid) => {
    try {
        // Find user's completed events
        const participatedEvents = await Participants.find({
            "participant_id.id": userid
        });
        
        if (!participatedEvents.length) {
            return; // No events found for this user
        }
        
        // Find or create user resume
        let userResume = await UserResume.findOne({ UserId: userid });
        if (!userResume) {
            userResume = new UserResume({
                UserId: userid,
                Journey: []
            });
            
            // Add first login achievement if this is a new resume
            const user = await User.findById(userid);
            if (user) {
                userResume.Journey.push({
                    title: "Joined UnifHub",
                    Date: user.createdAt || new Date(), // Ensure we always have a valid date
                    description: `${user.name} joined UnifHub and started their journey.`,
                    metrics: { achievementType: 'registration' },
                    isPosted: false // Mark as posted
                });
            }
        }
        
        // Process all participated events
        for (const participation of participatedEvents) {
            const { eventid, position } = participation;
            
            // Check if event exists and is completed
            const event = await Event.findById(eventid);
            if (!event || event.status !== "completed") {
                continue;
            }
            
            // Check if this event is already in the resume
            const eventExists = userResume.Journey.some(
                item => item.metrics && item.metrics.eventId && item.metrics.eventId.toString() === eventid.toString()
            );
            
            if (!eventExists) {
                // Get organization name
                const organization = await Organization.findById(event.organization_id);
                const orgName = organization ? organization.name : "An organization";
                
                // Create achievement description based on position
                let achievementTitle = `Participated in ${event.eventName}`;
                let achievementDescription = `Participated in ${event.eventName} organized by ${orgName}.`;
                
                if (position === 1) {
                    achievementTitle = `Won first place in ${event.eventName}`;
                    achievementDescription = `Won first place in ${event.eventName} organized by ${orgName}.`;
                } else if (position === 2) {
                    achievementTitle = `Won second place in ${event.eventName}`;
                    achievementDescription = `Won second place in ${event.eventName} organized by ${orgName}.`;
                } else if (position === 3) {
                    achievementTitle = `Won third place in ${event.eventName}`;
                    achievementDescription = `Won third place in ${event.eventName} organized by ${orgName}.`;
                }
                
                // Add to user's journey
                userResume.Journey.push({
                    title: achievementTitle,
                    Date: event.eventDate || new Date(), // Ensure we always have a valid date
                    description: achievementDescription,
                    metrics: { 
                        achievementType: 'event_participation',
                        eventId: eventid,
                        position: position
                    }
                });
            }
        }
        
        // Save changes
        await userResume.save();
        return userResume;
    } catch (err) {
        return null;
    }
};

// Check if user has joined any organization teams
const checkUserTeamMembership = async (userid, userResume) => {
    try {
        // Find teams where user is a member
        const teams = await Team.find({
            $or: [
                { "teamLeader.id": userid },
                { "teamMembers.id": userid }
            ]
        });
        
        if (!teams.length) return;
        
        for (const team of teams) {
            // Check if this team membership is already in the resume
            const teamExists = userResume.Journey.some(
                item => item.metrics && 
                      item.metrics.teamId && 
                      item.metrics.teamId.toString() === team._id.toString()
            );
            
            if (!teamExists) {
                // Determine user's role in team
                let role = "member";
                if (team.teamLeader.id.toString() === userid.toString()) {
                    role = "leader";
                }
                
                // Get organization info
                const organization = await Organization.findById(team.OrganizationId);
                const orgName = organization ? organization.name : "an organization";
                
                // Create achievement
                const title = role === "leader" 
                    ? `Became team leader of ${team.teamName}`
                    : `Joined team ${team.teamName}`;
                
                const description = role === "leader"
                    ? `Became the team leader of ${team.teamName} at ${orgName}.`
                    : `Joined ${team.teamName} team at ${orgName}.`;
                
                // Ensure we have a valid date
                const teamDate = team.createdAt || new Date();
                
                userResume.Journey.push({
                    title: title,
                    Date: teamDate,
                    description: description,
                    metrics: {
                        achievementType: 'team_membership',
                        teamId: team._id,
                        organizationId: team.OrganizationId,
                        role: role
                    }
                });
            }
        }
        
        // Save changes
        await userResume.save();
    } catch (err) {
    }
};

// Generate resume for a single user
const generateUserResume = async (userid) => {
    try {
        // Find or create user resume
        let userResume = await UserResume.findOne({ UserId: userid });
        if (!userResume) {
            userResume = new UserResume({
                UserId: userid,
                Journey: []
            });
            
            // Add first login achievement
            const user = await User.findById(userid);
            if (user) {
                userResume.Journey.push({
                    title: "Joined UnifHub",
                    Date: user.createdAt || new Date(),
                    description: `${user.name} joined UnifHub and started their journey.`,
                    metrics: { achievementType: 'registration' },
                    isPosted: false // Mark as posted
                });
            }
            
            await userResume.save();
        }
        
        // Check and update completed events
        await HandleCheckEventsCompleted(userid);
        
        // Check and update team memberships
        await checkUserTeamMembership(userid, userResume);
        
        return userResume;
    } catch (err) {
        return null;
    }
};

// Generate resume for all users
const generateResume = async (req, res) => {
    try {
        const Users = await User.find({});
        
        // Use Promise.all to process all users concurrently
        await Promise.all(
            Users.map(async (user) => {
                const userid = user._id;
                await generateUserResume(userid);
            })
        );
        
        res.status(200).json({ message: "All user resumes updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

// Update all user resumes (for nightly cron job)
const updateAllUserResumes = async () => {
    try {
        
        const Users = await User.find({});
        let updatedCount = 0;
        
        // Use Promise.all to process all users concurrently
        await Promise.all(
            Users.map(async (user) => {
                const userid = user._id;
                const userResume = await generateUserResume(userid);
                if (userResume) updatedCount++;
            })
        );
        
        return { success: true, updatedCount };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

const HandleGetUserResume = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find user resume or generate if it doesn't exist
        let userResume = await UserResume.findOne({ UserId: id });
        if (!userResume) {
            userResume = await generateUserResume(id);
            if (!userResume) {
                return res.status(404).json({ message: "User not found" });
            }
        }
        
        // Sort journey items by date (most recent first)
        userResume.Journey.sort((a, b) => new Date(b.Date) - new Date(a.Date));
        
        res.status(200).json(userResume);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

// Add a new achievement to a user's journey
const addUserAchievement = async (userId, achievement) => {
    try {
        // Find or create user resume
        let userResume = await UserResume.findOne({ UserId: userId });
        
        if (!userResume) {
            const user = await User.findById(userId);
            if (!user) {
                return null;
            }
            
            userResume = new UserResume({
                UserId: userId,
                Journey: []
            });
        }
        
        // Ensure we have a valid date
        const achievementDate = achievement.date || new Date();
        
        // Add the achievement
        userResume.Journey.push({
            title: achievement.title,
            Date: achievementDate, // Always use the validated date
            description: achievement.description,
            metrics: achievement.metrics || {},
            isPosted: false // Mark as posted
        });
        
        // Save changes
        await userResume.save();
        return userResume;
    } catch (err) {
        return null;
    }
};

// Function to track when a user completes their first event
const trackFirstEventCompletion = async (userId, eventId, eventName, organizationName) => {
    try {
        const userResume = await UserResume.findOne({ UserId: userId });
        
        if (!userResume) {
            return null; // Resume doesn't exist yet
        }
        
        // Check if user already has a "First Event Completed" achievement
        const hasFirstEventAchievement = userResume.Journey.some(
            item => item.metrics && item.metrics.achievementType === 'first_event_completion'
        );
        
        if (!hasFirstEventAchievement) {
            return await addUserAchievement(userId, {
                title: "First Event Completed",
                description: `Completed first event "${eventName}" organized by ${organizationName}.`,
                date: new Date(), // Explicitly provide a date
                metrics: {
                    achievementType: 'first_event_completion',
                    eventId
                }
            });
        }
        
        return userResume;
    } catch (err) {
        return null;
    }
};

module.exports = { 
    HandleGetUserResume, 
    generateResume, 
    updateAllUserResumes,
    HandleCheckEventsCompleted,
    addUserAchievement,
    trackFirstEventCompletion,
    generateUserResume
};