const Participants = require('../../models/Participants')
const Event = require('../../models/Event')
const User = require('../../models/User')
const Organization = require('../../models/Organizations')
const { addUserAchievement, trackFirstEventCompletion } = require('./UserResume')
const { HandleCheckHighParticipation } = require('./OrganizationJourney')
const { updateUserActivityAfterEvent } = require('./UserActivity')
const ParticipantsVerify = require('../../models/ParticipantsVerify')
const Mailer = require('../../config/SendMail')


const SendMail = new Mailer(process.env.ADMIN_EMAIL, process.env.EMAIL_PASS);


/**
 * Sends email notifications to team members when added to a new event team
 * @param {Object} newParticipant - The new participant object to be saved
 * @param {String} userId - ID of the user creating the team
 * @param {Array} formattedParticipants - Array of participant objects
 * @param {String} EventName - Name of the event
 * @returns {Promise} - Resolves when notifications are sent
 */
/**
 * Sends email notifications to team members when added to a new event team
 * @param {Object} newParticipant - The new participant object to be saved
 * @param {String} userId - ID of the user creating the team
 * @param {Array} formattedParticipants - Array of participant objects
 * @param {String} EventName - Name of the event
 * @returns {Promise} - Resolves when notifications are sent
 */
const HandleSendNotification = async (newParticipant, userId, formattedParticipants, EventName) => {
    try {
        // Save the new participant first
        await newParticipant.save();

        // Get the event details for more context in the email
        const eventDetails = await Event.findById(newParticipant.eventid).select('name description date');

        // Get creator information for the email signature
        const creator = await User.findById(userId).select('name email');

        // Properly encode the event name for the URL
        const encodedEventName = encodeURIComponent(EventName);

        // Send notifications in parallel to all participants except the creator
        await Promise.all(
            formattedParticipants.map(async (participant) => {
                if (userId !== participant.id) {
                    try {
                        const userDoc = await User.findById(participant.id).select('email name');

                        if (!userDoc || !userDoc.email) {
                            console.warn(`Email not found for user ${participant.id}`);
                            return;
                        }

                        const recipientEmail = userDoc.email;
                        const recipientName = userDoc.name || participant.name;
                        const senderEmail = process.env.ADMIN_EMAIL;

                        // Create email subject
                        const subject = `📢 Team Update: You've Been Added to a Team on UnifHub`;

                        // Create HTML content with CSS styling - white content on gray background
                        const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body {
                      font-family: 'Arial', sans-serif;
                      line-height: 1.6;
                      color: #333;
                      margin: 0;
                      padding: 0;
                      background-color: #f1f1f1;
                    }
                    .email-container {
                      max-width: 600px;
                      margin: 20px auto;
                      background-color: #f1f1f1;
                    }
                    .header {
                      background-color: #3a3a3a;
                      padding: 20px;
                      text-align: center;
                      color: white;
                      border-radius: 8px 8px 0 0;
                    }
                    .content {
                      padding: 30px 20px;
                      background-color: #ffffff;
                      border-left: 1px solid #e0e0e0;
                      border-right: 1px solid #e0e0e0;
                      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                    }
                    .footer {
                      background-color: #e6e6e6;
                      padding: 15px 20px;
                      text-align: center;
                      font-size: 12px;
                      color: #666;
                      border-radius: 0 0 8px 8px;
                      border: 1px solid #d9d9d9;
                    }
                    .button {
                      display: inline-block;
                      background-color: #3a3a3a;
                      color: white;
                      text-decoration: none;
                      padding: 12px 24px;
                      border-radius: 4px;
                      margin: 20px 0;
                      font-weight: bold;
                    }
                    .button:hover {
                      background-color: #555;
                    }
                    .logo {
                      font-size: 28px;
                      font-weight: bold;
                      color: white;
                      letter-spacing: 1px;
                    }
                    .event-details {
                      background-color: #f9f9f9;
                      border: 1px solid #e0e0e0;
                      border-radius: 4px;
                      padding: 20px;
                      margin: 20px 0;
                    }
                    .event-name {
                      color: #3a3a3a;
                      margin-top: 0;
                      margin-bottom: 10px;
                      font-size: 18px;
                    }
                    .divider {
                      height: 1px;
                      background-color: #e0e0e0;
                      margin: 20px 0;
                    }
                    .highlight {
                      color: #3a3a3a;
                      font-weight: bold;
                    }
                  </style>
                </head>
                <body>
                  <div class="email-container">
                    <div class="header">
                      <div class="logo">UnifHub</div>
                    </div>
                    <div class="content">
                      <h2>Hello ${recipientName},</h2>
                      <p>You have been added to a new team for the event <span class="highlight">${EventName}</span> by ${eventDetails.organizer
                            }.</p>
                      
                      <div class="event-details">
                        <h3 class="event-name">${eventDetails ? eventDetails.name : EventName}</h3>
                        <p>${eventDetails && eventDetails.description ? eventDetails.description : 'Join us for this exciting event!'}</p>
                        <p><strong>Date:</strong> ${eventDetails && eventDetails.date ? new Date(eventDetails.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Coming soon'}</p>
                      </div>
                      
                      <p>Log in to your dashboard to see more details and connect with your team members.</p>
                      
                      <div style="text-align: center;">
                        <a href="${process.env.CLIENT_URL}/events/${encodedEventName}?id=${newParticipant.eventid}" class="button">View Event Details</a>
                      </div>
                      
                      <div class="divider"></div>
                      
                      <p>If you have any questions, feel free to reach out to the event organizer.</p>
                      
                      <p>Best regards,<br><span class="highlight">The UnifHub Team</span></p>
                    </div>
                    <div class="footer">
                      <p>&copy; ${new Date().getFullYear()} UnifHub. All rights reserved.</p>
                      <p>This is an automated message, please do not reply directly to this email.</p>
                    </div>
                  </div>
                </body>
                </html>
              `;

                        // Plain text fallback for email clients that don't support HTML
                        const textContent = `
  Hello ${recipientName},
  
  You have been added to a new team for the event "${EventName}" by ${creator.name}.
  
  Please log in to your dashboard to see more details and connect with your team members.
  
  View the event here: ${process.env.CLIENT_URL}/events/${encodedEventName}?id=${newParticipant.eventid}
  
  Best regards,
  The UnifHub Team
              `;

                        // Send the email with both HTML and plain text versions
                        await SendMail.SendMailHTML(recipientEmail, senderEmail, subject, textContent, htmlContent);

                        console.log(`Notification sent successfully to ${recipientEmail}`);
                    } catch (userError) {
                        console.error(`Error processing notification for user ${participant.id}:`, userError);
                        // Continue with other participants even if one fails
                    }
                }
                else{
                    const userDoc = await ParticipantsVerify.updateOne({
                        eventid: newParticipant.eventid,
                        teamName: newParticipant.teamName,
                        "participant_id.id": userId
                    }, {
                        $set: {
                            "participant_id.$.verified": true
                        }
                    }); 
                }
            })
        );

        console.log("All notifications sent successfully!");
        return { success: true, message: "Team created and notifications sent" };

    } catch (error) {
        console.error("Error in HandleSendNotification:", error);
        throw new Error("Failed to send team notifications");
    }
};


const HandleVerifyParticipants = async (req, res) => {
    try {
        const { eventid, teamName } = req.body;
        console.log({ eventid, teamName });

        // Validate required fields
        if (!eventid || !teamName) {
            return res.status(400).json({ message: "Event ID and team name are required" });
        }

        // Check if event exists
        const event = await Event.findById(eventid);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Find the team in ParticipantsVerify
        const verifyTeam = await ParticipantsVerify.findOne({ eventid, teamName });
        if (!verifyTeam) {
            return res.status(404).json({ message: "Team not found" });
        }

        // Find participant in the verification list
        const participantIndex = verifyTeam.participant_id.findIndex(p => p.id === req.user.id);
        if (participantIndex === -1) {
            return res.status(400).json({ message: "User not found in team" });
        }

        // Check if already verified
        if (verifyTeam.participant_id[participantIndex].verified) {
            return res.status(400).json({ message: "User already verified" });
        }

        // Update verification status
        await ParticipantsVerify.updateOne(
            { eventid, teamName, "participant_id.id": req.user.id },
            { $set: { "participant_id.$.verified": true } }
        );

        // Find or create participant entry in Participants collection
        let participant = await Participants.findOne({ eventid, teamName });
        const user = await User.findById(req.user.id);

        if (!participant) {
            // Create new participant entry if it doesn't exist
            participant = new Participants({
                eventid,
                teamName,
                participant_id: [{
                    id: user._id.toString(),
                    name: user.name,
                    userid: user.userid,
                    profileImage: user.profileImage || null
                }],
                position: 0
            });
        } else {
            // Add user to existing participant entry
            const participantExists = participant.participant_id.some(p => p.id === req.user.id);
            if (!participantExists) {
                participant.participant_id.push({
                    id: user._id.toString(),
                    name: user.name,
                    userid: user.userid,
                    profileImage: user.profileImage || null
                });
            }
        }

        await participant.save();

        res.status(200).json({
            message: "Participant verified successfully",
            participant: participant
        });
    } catch (error) {
        console.error("Error in HandleVerifyParticipants:", error);
        res.status(500).json({ message: "Failed to verify participant", error: error.message });
    }
};


const HandleAddParticipants = async (req, res) => {
    try {
        const { eventid, participant_ids, teamName } = req.body;
        console.log({ eventid, participant_ids, teamName })
        console.log("Request body:", req.user.id);

        // Check if event exists
        const event = await Event.findById(eventid);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }


        // Ensure participant_ids is a valid array
        if (!Array.isArray(participant_ids) || participant_ids.length === 0) {
            return res.status(400).json({ message: "participant_ids should be a non-empty array" });
        }

        // Check if team name already exists
        const existingTeam = await Participants.findOne({ eventid, teamName });
        if (existingTeam) {
            return res.status(400).json({ message: "Team name already exists for this event" });
        }

        // Get user details for all participants
        const userIds = participant_ids;
        const users = await User.find({ _id: { $in: userIds } });

        if (users.length !== userIds.length) {
            return res.status(404).json({ message: "One or more participants not found" });
        }

        //any user are not paricipated in this event
        const alreadyParticipated = await Participants.findOne({ eventid, "participant_id.id": userIds });
        if (alreadyParticipated) {
            return res.status(400).json({ message: "One or more participants have already registered for this event" });
        }
        // Format participant data according to new schema
        let formattedParticipants = users.map(user => ({
            id: user._id.toString(),
            name: user.name,
            userid: user.userid,
            profileImage: user.profileImage ? user.profileImage : null
        }));


        await Promise.all(
            formattedParticipants.map(async (participant) => {
                if (req.user.id == participant.id) {
                    const newParticipant = new Participants({
                        eventid,
                        teamName,
                        participant_id: [participant],
                        position: 0 // Default position
                    });
                    await newParticipant.save();
                }
            })
        );

        formattedParticipants = users.map(user => ({
            id: user._id.toString(),
            name: user.name,
            userid: user.userid,
            profileImage: user.profileImage ? user.profileImage : null,
            verified: false // Default verified status
        }));


        // Save new participant entry to the database
        const newParticipantVerify = new ParticipantsVerify({
            eventid,
            teamName,
            participant_id: formattedParticipants,
            position: 0 // Default position as number
        });

        await HandleSendNotification(newParticipantVerify, req.user.id, formattedParticipants, event.eventName);

        // Update total participants count
        event.totalparticipants += formattedParticipants.length;
        event.totalteams += 1;
        await event.save();

        // Get organization details for achievement tracking
        const organization = await Organization.findById(event.organization_id);
        const orgName = organization ? organization.name : "Unknown organization";

        // Update each user's event list and add achievement for joining event
        await Promise.all(
            userIds.map(async (id) => {
                const user = await User.findById(id);
                if (user && !user.events.some(e => e.eventid.toString() === eventid)) {
                    // Add event to user's event list
                    user.events.push({ eventid, position: 0 });
                    await user.save();

                    // Add achievement for registering for the event
                    await addUserAchievement(id, {
                        title: `Registered for ${event.eventName}`,
                        description: `Joined ${event.eventName} organized by ${orgName}.`,
                        metrics: {
                            achievementType: 'event_registration',
                            eventId: eventid,
                            organizationId: event.organization_id
                        }
                    });

                    // Update user activity score
                    await updateUserActivityAfterEvent(id);
                }
            })
        );

        // Check for high participation achievement after adding new participants
        // Run in background to avoid blocking the response
        if (event.totalparticipants >= 100) {
            HandleCheckHighParticipation(eventid, event.organization_id)
                .then(result => {
                    if (result) {
                        console.log(`High participation achievement checked for event ${eventid}`);
                    }
                })
                .catch(err => {
                    console.error("Error checking high participation achievement:", err);
                });
        }

        res.status(201).json({
            message: "Participants added successfully",
            participants: newParticipantVerify
        });
    } catch (error) {
        res.status(500).json({ message: "Error registering for event", error: error.message });
    }
};



const HandleUpdateParticipantsTeam = async (req, res) => {
    try {
        const { eventid, teamName, participant_ids } = req.body;
        console.log({ eventid, teamName, participant_ids })

        // Validate required fields
        if (!eventid || !teamName || !participant_ids) {
            return res.status(400).json({ message: "Event ID, team name, and participant IDs are required" });
        }

        // Check if event exists
        const event = await Event.findById(eventid);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Check if team exists in ParticipantsVerify
        const verifyTeam = await ParticipantsVerify.findOne({ eventid, teamName });
        if (!verifyTeam) {
            return res.status(404).json({ message: "Team not found in verification queue" });
        }

        // Get user details for all participants
        const userIds = participant_ids;
        const users = await User.find({ _id: { $in: userIds } });

        if (users.length !== userIds.length) {
            return res.status(404).json({ message: "One or more participants not found" });
        }

        // Check if any user is already in ParticipantsVerify for this event (in any team)
        const existingInVerify = await ParticipantsVerify.findOne({
            eventid,
            "participant_id.id": { $in: userIds },
            teamName: { $ne: teamName } // Exclude current team
        });

        if (existingInVerify) {
            return res.status(400).json({ 
                message: "One or more participants have already registered for this event and are pending verification" 
            });
        }

        // Check if any user is already participating in this event
        const alreadyParticipated = await Participants.findOne({ 
            eventid, 
            "participant_id.id": { $in: userIds },
            teamName: { $ne: teamName } // Exclude current team
        });
        
        if (alreadyParticipated) {
            return res.status(400).json({ 
                message: "One or more participants have already registered for this event in another team" 
            });
        }

        // Check if any of the users are already in this team's verification queue
        const existingUsers = verifyTeam.participant_id.map(p => p.id.toString());
        const duplicateUsers = userIds.filter(id => existingUsers.includes(id.toString()));
        
        if (duplicateUsers.length > 0) {
            return res.status(400).json({ 
                message: "One or more participants are already in this team's verification queue" 
            });
        }

        // Format participant data for verification
        const formattedParticipants = users.map(user => ({
            id: user._id.toString(),
            name: user.name,
            userid: user.userid,
            profileImage: user.profileImage || null,
            verified: false
        }));

        // Update ParticipantsVerify collection
        const updatedVerifyTeam = await ParticipantsVerify.findOneAndUpdate(
            { eventid, teamName },
            { $push: { participant_id: { $each: formattedParticipants } } },
            { new: true }
        );

        // Send notifications to new team members
        await HandleSendNotification(updatedVerifyTeam, req.user.id, formattedParticipants, event.eventName);

        res.status(200).json({
            message: "Participants added to verification queue successfully",
            team: updatedVerifyTeam
        });

    } catch (error) {
        console.error("Error updating participants team:", error);
        res.status(500).json({ message: "Error updating participants team", error: error.message });
    }
}

const HandleGetAllParticipants = async (req, res) => {
    try {
        const { eventid } = req.query;

        // If eventid is provided, filter by event
        const filter = eventid ? { eventid } : {};

        // Get all participants
        const participants = await Participants.find(filter)
            .sort({ position: 1, createdAt: 1 });

        res.status(200).json({
            message: "Participants retrieved successfully",
            count: participants.length,
            participants
        });
    } catch (error) {
        res.status(500).json({ message: "Error retrieving participants", error: error.message });
    }
}

const HandleUpdateParticipants = async (req, res) => {
    try {
        const { id } = req.params;
        const { teamName, position } = req.body;


        // Find participant by id
        const participant = await Participants.findById(id);
        if (!participant) {
            return res.status(404).json({ message: "Participant not found" });
        }

        // If team name is being updated, check for duplicates
        if (teamName && teamName !== participant.teamName) {
            const existingTeam = await Participants.findOne({
                eventid: participant.eventid,
                teamName,
                _id: { $ne: id } // Exclude current participant
            });

            if (existingTeam) {
                return res.status(400).json({ message: "Team name already exists for this event" });
            }
        }

        // Convert position to number if provided
        const updates = {};
        if (teamName) updates.teamName = teamName;
        if (position !== undefined) updates.position = Number(position);

        // Update the participant
        const updatedParticipant = await Participants.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: "Participant updated successfully",
            participant: updatedParticipant
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating participant", error: error.message });
    }
}

const HandleDeleteParticipants = async (req, res) => {
    try {
        const { id } = req.params;
        console.log({ id })

        // Find and delete participant
        const deletedParticipant = await Participants.findByIdAndDelete(id);

        if (!deletedParticipant) {
            return res.status(404).json({ message: "Participant not found" });
        }

        res.status(200).json({
            message: "Participant deleted successfully",
            participant: deletedParticipant
        });
    } catch (error) {
        res.status(500).json({ message: "Error deleting participant", error: error.message });
    }
}

const HandleDeleteTeam = async (req, res) => {
    try {
        const { eventid, teamName } = req.query;

        if (!eventid || !teamName) {
            return res.status(400).json({ message: "Event ID and team name are required" });
        }

        // Delete all participants with the given team name in the specified event
        const result = await Participants.deleteMany({ eventid, teamName });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Team not found or already deleted" });
        }

        res.status(200).json({
            message: "Team deleted successfully",
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ message: "Error deleting team", error: error.message });
    }
}

const HandleDeclareResult = async (req, res) => {
    try {
        const { eventid, results } = req.body;

        console.log({ eventid, results });

        // Validate event exists
        const event = await Event.findById(eventid);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Extract only the date part (YYYY-MM-DD) from eventDate and current date
        const eventDate = event.eventDate.toISOString().slice(0, 10);
        const currentDate = new Date().toISOString().slice(0, 10);

        console.log("Event Date:", eventDate);
        console.log("Current Date:", currentDate);

        // Check if event date is different from today's date
        if (eventDate !== currentDate) {
            return res.status(400).json({ message: "Event has not started yet." });
        }

        // Validate results array
        if (!Array.isArray(results) || results.length === 0) {
            return res.status(400).json({ message: "Results must be a non-empty array" });
        }

        // Get organization details
        const organization = await Organization.findById(event.organization_id);
        const orgName = organization ? organization.name : "Unknown organization";

        // Update positions for teams
        const updatePromises = results.map((result) => {
            return Participants.findOneAndUpdate(
                { eventid, teamName: result.teamName },
                { position: Number(result.position) },
                { new: true }
            );
        });

        const updatedParticipants = await Promise.all(updatePromises);

        // Update event status to completed
        await Event.findByIdAndUpdate(eventid, { status: "completed" });

        // Add achievements for participants
        for (const team of updatedParticipants) {
            if (!team) continue;
            if (team.position === 0) continue;

            for (const participant of team.participant_id) {
                const userId = participant.id;

                // Track first event completion
                await trackFirstEventCompletion(userId, eventid, event.eventName, orgName);

                // Create achievement based on position
                let title = `Participated in ${event.eventName}`;
                let description = `Completed ${event.eventName} organized by ${orgName}.`;

                if (team.position === 1) {
                    title = `Won first place in ${event.eventName}`;
                    description = `Won first place in ${event.eventName} organized by ${orgName}.`;
                } else if (team.position === 2) {
                    title = `Won second place in ${event.eventName}`;
                    description = `Won second place in ${event.eventName} organized by ${orgName}.`;
                } else if (team.position === 3) {
                    title = `Won third place in ${event.eventName}`;
                    description = `Won third place in ${event.eventName} organized by ${orgName}.`;
                }

                await addUserAchievement(userId, {
                    title,
                    description,
                    date: new Date(),
                    metrics: {
                        achievementType: "event_completion",
                        eventId: eventid,
                        position: team.position,
                        organizationId: event.organization_id,
                    },
                });
            }
        }

        res.status(200).json({
            message: "Results declared successfully",
            updatedParticipants,
        });
    } catch (error) {
        console.error("Error declaring results:", error);
        res.status(500).json({ message: "Error declaring results", error: error.message });
    }
};


const HandleEditResult = async (req, res) => {
    try {
        const { eventid, teamName, position } = req.body;

        if (!eventid || !teamName || position === undefined) {
            return res.status(400).json({
                message: "Event ID, team name, and position are required"
            });
        }

        // Validate event exists
        const event = await Event.findById(eventid);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Find and update team position
        const updatedParticipant = await Participants.findOneAndUpdate(
            { eventid, teamName },
            { position: Number(position) },
            { new: true, runValidators: true }
        );

        if (!updatedParticipant) {
            return res.status(404).json({
                message: "Team not found for this event"
            });
        }

        res.status(200).json({
            message: "Result updated successfully",
            participant: updatedParticipant
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating result", error: error.message });
    }
}

const HandleCheckTeam = async (req, res) => {
    try {
        const { teamName, eventid } = req.body;

        // Validate input
        if (!teamName || !eventid) {
            return res.status(400).json({ message: "Team name and event ID are required." });
        }

        // Find if the team name already exists for the given event
        const existingTeam = await Participants.findOne({ eventid, teamName });

        if (existingTeam) {
            return res.status(200).json({ result: false });
        } else {
            return res.status(200).json({ result: true });
        }
    } catch (error) {
        console.error("Error checking team name:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

const HandleGetParticipantsByEvent = async (req, res) => {
    try {
        const { eventid } = req.params;

        // Find all participants for the given event
        const participants = await Participants.find({ eventid });

        if (participants.length === 0) {
            return res.status(404).json({
                message: "No participants found for this event",
                count: 0,
                participants: []
            });
        }

        console.log(participants);

        res.status(200).json({
            message: "Participants retrieved successfully",
            count: participants.length,
            participants
        });
    } catch (error) {
        res.status(500).json({
            message: "Error retrieving participants",
            error: error.message
        });
    }
}

const HandleGetParticipantsByUserId = async (req, res) => {
    try {
        const { eventid, userid } = req.body;

        // Find participants where participant_id array contains an object with the given userid
        const participants = await Participants.find({
            eventid: eventid,
            "participant_id.id": userid
        });

        if (participants.length === 0) {
            return res.status(404).json({
                message: "No participants found for this user ID",
                count: 0,
                participants: []
            });
        }

        // Get the team details
        const team = participants[0];

        // Fetch user details including profile image
        const formattedParticipants = await Promise.all(
            team.participant_id.map(async (user) => {
                const findUser = await User.findById(user.id);
                return {
                    ...user.toObject(),
                    ProfileImage: findUser?.profileImage || ""
                };
            })
        );

        res.status(200).json({
            message: "Participants retrieved successfully",
            count: formattedParticipants.length,
            newParticipants: {
                teamName: team.teamName,
                participants: formattedParticipants
            }
        });
    } catch (error) {
        console.error("Error retrieving participants:", error);
        res.status(500).json({
            message: "Error retrieving participants",
            error: error.message
        });
    }
};
const HandleGetVerifyedParticipantsByUserId = async (req, res) => {
    try {
        const { eventid, userid } = req.body;

        // Find participants where participant_id array contains an object with the given userid
        const participants = await ParticipantsVerify.find({
            eventid: eventid,
            "participant_id.id": userid
        });

        if (participants.length === 0) {
            return res.status(404).json({
                message: "No participants found for this user ID",
                count: 0,
                participants: []
            });
        }

        // Get the team details
        const team = participants[0];

        // Fetch user details including profile image
        const formattedParticipants = await Promise.all(
            team.participant_id.map(async (user) => {
                const findUser = await User.findById(user.id);
                return {
                    ...user.toObject(),
                    ProfileImage: findUser?.profileImage || ""
                };
            })
        );

        res.status(200).json({
            message: "Participants retrieved successfully",
            count: formattedParticipants.length,
            newParticipants: {
                teamName: team.teamName,
                participants: formattedParticipants
            }
        });
    } catch (error) {
        console.error("Error retrieving participants:", error);
        res.status(500).json({
            message: "Error retrieving participants",
            error: error.message
        });
    }
};


const HandleSearchParticipants = async (req, res) => {
    try {
        const { query } = req.query;
        const { eventid } = req.body;

        if (!query?.trim()) {
            return res.status(400).json({ success: false, message: "Search query is required." });
        }

        // Search users by `userid` using case-insensitive regex
        const members = await User.find(
            { userid: { $regex: `^${query}`, $options: "i" } }
        ).limit(10);

        // Prepare the array to store results
        const NewMembers = [];

        // Check if each user is already participating in the event
        await Promise.all(
            members.map(async (member) => {
                const alreadyParticipated = await Participants.findOne({
                    eventid: eventid,
                    "participant_id.id": member._id
                });

                // Push each user's data into the array
                NewMembers.push({
                    name: member.name,
                    userid: member.userid,
                    ProfileImage: member.profileImage,
                    IsUserExsit: !!alreadyParticipated, // Converts to true/false
                    _id: member._id
                });
            })
        );

        return res.status(200).json({ success: true, members: NewMembers });
    } catch (error) {
        console.error("Search error:", error.message);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};




module.exports = {
    HandleAddParticipants,
    HandleGetAllParticipants,
    HandleUpdateParticipants,
    HandleDeleteParticipants,
    HandleDeleteTeam,
    HandleDeclareResult,
    HandleEditResult,
    HandleCheckTeam,
    HandleGetParticipantsByEvent,
    HandleGetParticipantsByUserId,
    HandleUpdateParticipantsTeam,
    HandleSearchParticipants,
    HandleVerifyParticipants,
    HandleGetVerifyedParticipantsByUserId
}