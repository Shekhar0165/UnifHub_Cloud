const User = require('../../models/User')
const participants = require('../../models/Participants')
const EventMember = require('../../models/EventsMember')
const Event = require('../../models/Event')
const Team = require('../../models/Teams')
const UserResume = require('../../models/UserResume')
const SendMail = require('../../config/SendMail')
const Organization = require('../../models/Organizations')
const { updateUserActivityAfterEvent } = require('./UserActivity')

// Create an instance of SendMail with admin credentials
const mailer = new SendMail(process.env.ADMIN_EMAIL, process.env.EMAIL_PASS);

const HandleAddTeamMemberInEvents = async (req, res) => {
    try {
        const { eventHead, eventViceHead, eventId, eventTeams } = req.body;
        const { id } = req.params;
        const org = req.user.id;
        const organizationId = org;
        if (organizationId !== id) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Validate organization exists
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Validate event exists and belongs to the organization
        const event = await Event.findOne({
            _id: eventId, organization_id: organizationId
        });
        if (!event) {
            return res.status(404).json({ message: "Event not found or does not belong to this organization" });
        }

        // Check if event members already exist for this event
        const existingEventMember = await EventMember.findOne({ eventId, organizationId });
        if (existingEventMember) {
            return res.status(400).json({
                message: "Teams for this event already exist. Please use the update endpoint instead.",
                existingTeams: {
                    eventHead: existingEventMember.eventHead,
                    eventViceHead: existingEventMember.eventViceHead,
                    eventTeams: existingEventMember.eventTeams
                }
            });
        }

        // Create event member record
        const eventMember = new EventMember({
            organizationId,
            eventId,
            eventHead,
            eventViceHead,
            eventTeams
        });

        await eventMember.save();
        event.isteamadded = true;
        await event.save();

        // Respond immediately to the client
        res.status(200).json({
            message: "Team members added successfully",
            eventMember
        });

        // Process emails and resume updates in the background
        setTimeout(() => {
            processTeamMembersBackground(eventHead, eventViceHead, eventTeams, eventId, organizationId, organization, event);
        }, 500);

    } catch (error) {
        console.error("Error in HandleAddTeamMemberInEvents:", error);
        res.status(500).json({
            message: "Error adding team members",
            error: error.message
        });
    }
}

// Background processing function for team members
const processTeamMembersBackground = async (eventHead, eventViceHead, eventTeams, eventId, organizationId, organization, event) => {
    try {
        // Collect all unique member IDs
        const allMembers = new Set();
        allMembers.add(eventHead);
        allMembers.add(eventViceHead);
        eventTeams.forEach(team => {
            team.members.forEach(memberId => allMembers.add(memberId));
        });
        
        // Fetch all users in one query
        const memberIds = Array.from(allMembers);
        const users = await User.find({ _id: { $in: memberIds } });
        
        // Map users by ID for easy lookup
        const userMap = {};
        users.forEach(user => {
            if (user) userMap[user._id.toString()] = user;
        });
        
        // Process users in batches to avoid overloading the system
        const batchSize = 5; // Process 5 users at a time
        const processBatch = async (startIdx) => {
            const batch = memberIds.slice(startIdx, startIdx + batchSize);
            const promises = [];
            
            for (const memberId of batch) {
                const user = userMap[memberId];
                if (!user) continue;
                
                // Resume update promise
                promises.push((async () => {
                    try {
                        let userResume = await UserResume.findOne({ UserId: memberId });
                        if (!userResume) {
                            userResume = new UserResume({ UserId: memberId });
                        }
                        
                        const role = memberId === eventHead ? 'Event Head' :
                            memberId === eventViceHead ? 'Event Vice Head' : 'Team Member';
                        const teamName = eventTeams.find(team => team.members.includes(memberId))?.teamName || 'General Team';
                        
                        const journeyEntry = {
                            title: `Event Role: ${role} - ${event.eventName}`,
                            Date: new Date(),
                            description: `Served as ${role} for the event "${event.eventName}" organized by ${organization.name}. ${teamName !== 'General Team' ? `Part of the ${teamName} team.` : ''}`,
                            metrics: {
                                eventId: eventId,
                                organizationId: organizationId,
                                organizationName: organization.name,
                                teamName: teamName,
                                startDate: event.startDate,
                                endDate: event.endDate
                            }
                        };
                        
                        if (!userResume.Journey) {
                            userResume.Journey = [];
                        }
                        userResume.Journey.push(journeyEntry);
                        await userResume.save();
                        
                        // Update user activity score
                        await updateUserActivityAfterEvent(memberId);
                    } catch (error) {
                        console.error(`Error updating resume for user ${memberId}:`, error);
                    }
                })());
                
                // Email sending promise
                promises.push((async () => {
                    try {
                        const role = memberId === eventHead ? 'Event Head' :
                            memberId === eventViceHead ? 'Event Vice Head' : 'Team Member';
                        const teamName = eventTeams.find(team => team.members.includes(memberId))?.teamName || 'General Team';
                        
                        const emailSubject = `You've been assigned to ${event.eventName}`;
                        const emailBody = `
                            Dear ${user.name},
                            
                            You have been assigned to the event "${event.eventName}" as ${role}.
                            ${teamName !== 'General Team' ? `You are part of the ${teamName} team.` : ''}
                            
                            Event Details:
                            - Name: ${event.eventName}
                            - Organization: ${organization.name}
                            - Start Date: ${new Date(event.startDate).toLocaleDateString()}
                            - End Date: ${new Date(event.endDate).toLocaleDateString()}
                            
                            Best regards,
                            UnifHub Team
                        `;
                        
                        await mailer.SendMail(user.email, process.env.ADMIN_EMAIL, emailSubject, emailBody);
                    } catch (error) {
                        console.error(`Error sending email to user ${memberId}:`, error);
                    }
                })());
            }
            
            await Promise.all(promises);
            
            // Process next batch if there are more users
            if (startIdx + batchSize < memberIds.length) {
                // Add a small delay between batches to prevent overloading
                setTimeout(() => {
                    processBatch(startIdx + batchSize);
                }, 1000);
            }
        };
        
        // Start processing first batch
        processBatch(0);
        
    } catch (error) {
        console.error("Error in background processing:", error);
    }
}

const HandleGetAllEvents = async (req, res) => {
    try {
        const { id } = req.params;
        const { eventId } = req.body;
        const organizationId = id;
        // Validate organization exists
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }


        const event = await Event.findOne({
            _id: eventId,
            organization_id: organizationId
        });

        if (!event) {
            return res.status(404).json({ message: "Event not found or does not belong to this organization" });
        }

        const eventMember = await EventMember.findOne({
            eventId: eventId,
            organizationId: organizationId
        });

        if (!eventMember) {
            return res.status(404).json({ message: "No teams found for this event" });
        }

        // Get user details for event head
        const eventHeadUser = await User.findById(eventMember.eventHead);
        const eventViceHeadUser = await User.findById(eventMember.eventViceHead);
        
        // Process teams to include user details
        const processedTeams = [];
        
        for (const team of eventMember.eventTeams) {
            const teamWithUserDetails = {
                teamId: team.teamId,
                teamName: team.teamName,
                members: []
            };
            
            // Get user details for each team member
            for (const memberId of team.members) {
                const member = await User.findById(memberId);
                if (member) {
                    teamWithUserDetails.members.push({
                        _id: member._id,
                        userid: member.userid,
                        name: member.name,
                        email: member.email,
                        profilePath: member.profileImage || null,
                        phone: member.phone || null,
                        college: member.college || null,
                        role: memberId === eventMember.eventHead ? 'Event Head' : 
                              memberId === eventMember.eventViceHead ? 'Event Vice Head' : 
                              'Team Member'
                    });
                }
            }
            
            processedTeams.push(teamWithUserDetails);
        }

        const EventTeam = {
            eventHead: {
                _id: eventHeadUser?._id,
                userid: eventHeadUser?.userid,
                name: eventHeadUser?.name,
                profilePath: eventHeadUser?.profileImage || null,
                role: 'Event Head'
            },
            eventViceHead: {
                _id: eventViceHeadUser?._id,
                userid: eventViceHeadUser?.userid,
                name: eventViceHeadUser?.name,
                profilePath: eventViceHeadUser?.profileImage || null,
                role: 'Event Vice Head'
            },
            eventName: event.eventName,
            eventId: event._id,
            teams: processedTeams
        };

        return res.status(200).json({ 
            message: "Event team details retrieved successfully",
            eventDetails: EventTeam 
        });

    } catch (error) {
        res.status(500).json({
            message: "Error retrieving events",
            error: error.message
        });
    }
}

const HandleUpdateEventMember = async (req, res) => {
    try {
        const { id } = req.params;
        const org = req.user.id;
        const organizationId = id;
        if (organizationId !== org) {
            return res.status(401).json({ message: "Unauthorized" })
        }
        const { eventId, eventHead, eventViceHead, eventTeams } = req.body;

        // Validate organization exists
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Validate event exists and belongs to the organization
        const event = await Event.findOne({
            _id: eventId,
            organization_id: organizationId
        });
        if (!event) {
            return res.status(404).json({ message: "Event not found or does not belong to this organization" });
        }

        // Find and update event member
        let eventMember = await EventMember.findOne({ eventId, organizationId });
        if (!eventMember) {
            return res.status(404).json({ message: "Event member record not found" });
        }

        // Update fields
        eventMember.eventHead = eventHead || eventMember.eventHead;
        eventMember.eventViceHead = eventViceHead || eventMember.eventViceHead;
        eventMember.eventTeams = eventTeams || eventMember.eventTeams;

        await eventMember.save();

        // Get all affected members (new and old)
        const oldMembers = new Set();
        oldMembers.add(eventMember.eventHead);
        oldMembers.add(eventMember.eventViceHead);
        eventMember.eventTeams.forEach(team => {
            team.members.forEach(memberId => oldMembers.add(memberId));
        });

        const newMembers = new Set();
        newMembers.add(eventHead);
        newMembers.add(eventViceHead);
        eventTeams.forEach(team => {
            team.members.forEach(memberId => newMembers.add(memberId));
        });

        // Process each new member
        for (const memberId of newMembers) {
            if (!oldMembers.has(memberId)) {
                const user = await User.findById(memberId);
                if (!user) continue;

                // Update user resume
                let userResume = await UserResume.findOne({ UserId: memberId });
                if (!userResume) {
                    userResume = new UserResume({ UserId: memberId });
                }

                const role = memberId === eventHead ? 'Event Head' :
                    memberId === eventViceHead ? 'Event Vice Head' :
                        'Team Member';
                const teamName = eventTeams.find(team => team.members.includes(memberId))?.teamName || 'General Team';

                const journeyEntry = {
                    title: `Event Role: ${role} - ${event.eventName}`,
                    Date: new Date(),
                    description: `Served as ${role} for the event "${event.eventName}" organized by ${organization.name}. ${teamName !== 'General Team' ? `Part of the ${teamName} team.` : ''}`,
                    metrics: {
                        eventId: eventId,
                        organizationId: organizationId,
                        organizationName: organization.name,
                        teamName: teamName,
                        startDate: event.startDate,
                        endDate: event.endDate
                    }
                };

                if (!userResume.Journey) {
                    userResume.Journey = [];
                }
                userResume.Journey.push(journeyEntry);
                await userResume.save();

                // Send email notification
                const emailSubject = `You've been assigned to ${event.eventName}`;
                const emailBody = `
                    Dear ${user.name},
                    
                    You have been assigned to the event "${event.eventName}" as ${role}.
                    ${teamName !== 'General Team' ? `You are part of the ${teamName} team.` : ''}
                    
                    Event Details:
                    - Name: ${event.eventName}
                    - Organization: ${organization.name}
                    - Start Date: ${new Date(event.startDate).toLocaleDateString()}
                    - End Date: ${new Date(event.endDate).toLocaleDateString()}
                    
                    Best regards,
                    UnifHub Team
                `;

                await mailer.SendMail(user.email, process.env.ADMIN_EMAIL, emailSubject, emailBody);
            }
        }

        // Get detailed information for the response
        // Get user details for event head
        const eventHeadUser = await User.findById(eventMember.eventHead);
        const eventViceHeadUser = await User.findById(eventMember.eventViceHead);
        
        // Process teams to include user details
        const processedTeams = [];
        
        for (const team of eventMember.eventTeams) {
            const teamWithUserDetails = {
                teamId: team.teamId,
                teamName: team.teamName,
                members: []
            };
            
            // Get user details for each team member
            for (const memberId of team.members) {
                const member = await User.findById(memberId);
                if (member) {
                    teamWithUserDetails.members.push({
                        _id: member._id,
                        name: member.name,
                        email: member.email,
                        profilePath: member.profilePath || null,
                        phone: member.phone || null,
                        college: member.college || null,
                        role: memberId === eventMember.eventHead ? 'Event Head' : 
                              memberId === eventMember.eventViceHead ? 'Event Vice Head' : 
                              'Team Member'
                    });
                }
            }
            
            processedTeams.push(teamWithUserDetails);
        }

        const EventTeam = {
            eventHead: {
                _id: eventHeadUser?._id,
                name: eventHeadUser?.name,
                email: eventHeadUser?.email,
                profilePath: eventHeadUser?.profilePath || null,
                phone: eventHeadUser?.phone || null,
                college: eventHeadUser?.college || null,
                role: 'Event Head'
            },
            eventViceHead: {
                _id: eventViceHeadUser?._id,
                name: eventViceHeadUser?.name,
                email: eventViceHeadUser?.email,
                profilePath: eventViceHeadUser?.profilePath || null,
                phone: eventViceHeadUser?.phone || null,
                college: eventViceHeadUser?.college || null,
                role: 'Event Vice Head'
            },
            eventName: event.eventName,
            eventId: event._id,
            eventStatus: event.status,
            eventStartDate: event.startDate,
            eventEndDate: event.endDate,
            eventLocation: event.location || null,
            eventDescription: event.description,
            teams: processedTeams
        };

        res.status(200).json({
            message: "Event members updated successfully",
            eventDetails: EventTeam
        });

    } catch (error) {
        res.status(500).json({
            message: "Error updating event members",
            error: error.message
        });
    }
}

module.exports = { HandleAddTeamMemberInEvents, HandleGetAllEvents, HandleUpdateEventMember }