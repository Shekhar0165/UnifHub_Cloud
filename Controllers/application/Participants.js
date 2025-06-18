const Participants = require('../../models/Participants')
const Event = require('../../models/Event')
const User = require('../../models/User')
const Organization = require('../../models/Organizations')
const { addUserAchievement, trackFirstEventCompletion } = require('./UserResume')
const { HandleCheckHighParticipation } = require('./OrganizationJourney')
const { updateUserActivityAfterEvent } = require('./UserActivity')
const ParticipantsVerify = require('../../models/ParticipantsVerify')
const Mailer = require('../../config/SendMail')
const { HandleSendNotificationOnPlatfrom, handleSendNotificationtoParticipants } = require('../application/Notification')


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
    const eventDetails = await Event.findById(newParticipant.eventid).select('eventName description eventDate');

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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #2c3e50;
      margin: 0;
      padding: 0;
      background-color: #f8f9fa;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f8f9fa;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 650px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.08);
      border: 1px solid #e9ecef;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 40px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
      opacity: 0.3;
    }
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: white;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }
    .tagline {
      font-size: 14px;
      color: rgba(255,255,255,0.9);
      margin-top: 5px;
      font-weight: 300;
      position: relative;
      z-index: 1;
    }
    .content {
      padding: 40px;
      background-color: #ffffff;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 20px;
    }
    .intro-text {
      font-size: 16px;
      color: #5a6c7d;
      margin-bottom: 30px;
      line-height: 1.7;
    }
    .highlight {
      color: #667eea;
      font-weight: 600;
    }
    .event-card {
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
      border: 2px solid #e9ecef;
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
      position: relative;
      overflow: hidden;
    }
    .event-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .event-name {
      color: #2c3e50;
      margin: 0 0 15px 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .event-description {
      color: #5a6c7d;
      font-size: 16px;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .event-meta {
      display: flex;
      align-items: center;
      background-color: rgba(102, 126, 234, 0.08);
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
    }
    .event-meta-icon {
      width: 24px;
      height: 24px;
      margin-right: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
    }
    .event-date {
      font-weight: 600;
      color: #2c3e50;
      font-size: 16px;
    }
    .cta-section {
      text-align: center;
      margin: 40px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      letter-spacing: 0.3px;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #e9ecef, transparent);
      margin: 40px 0;
    }
    .footer-content {
      color: #6c757d;
      font-size: 15px;
      line-height: 1.6;
    }
    .signature {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #f1f3f4;
    }
    .signature-name {
      font-weight: 600;
      color: #2c3e50;
      font-size: 16px;
    }
    .signature-title {
      color: #6c757d;
      font-size: 14px;
      margin-top: 2px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer-text {
      font-size: 13px;
      color: #6c757d;
      line-height: 1.5;
    }
    .footer-links {
      margin-top: 15px;
    }
    .footer-link {
      color: #667eea;
      text-decoration: none;
      margin: 0 10px;
      font-size: 13px;
    }
    .footer-link:hover {
      text-decoration: underline;
    }
    .social-icons {
      margin-top: 20px;
    }
    .social-icon {
      display: inline-block;
      width: 32px;
      height: 32px;
      background-color: #667eea;
      border-radius: 50%;
      margin: 0 5px;
      line-height: 32px;
      color: white;
      text-decoration: none;
      font-size: 14px;
    }
    
    /* Mobile responsiveness */
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      .content {
        padding: 30px 25px;
      }
      .header {
        padding: 25px 25px;
      }
      .event-card {
        padding: 25px 20px;
      }
      .logo {
        font-size: 28px;
      }
      .greeting {
        font-size: 18px;
      }
      .event-name {
        font-size: 20px;
      }
      .cta-button {
        padding: 14px 28px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">UnifHub</div>
        <div class="tagline">Connecting Teams, Creating Success</div>
      </div>
      
      <div class="content">
        <h1 class="greeting">Hello ${recipientName},</h1>
        
        <p class="intro-text">
          We're excited to inform you that <span class="highlight">${creator.name}</span> has added you to their team for the upcoming event <span class="highlight">"${EventName}"</span>. 
          You're now part of an amazing group ready to make this event a success!
        </p>
        
        <div class="event-card">
          <h2 class="event-name">${EventName}</h2>
          <p class="event-description">
            ${eventDetails && eventDetails.description ? eventDetails.description : 'Join us for this exciting event where innovation meets collaboration. Get ready for an unforgettable experience!'}
          </p>
          
          <div class="event-meta">
            <div class="event-meta-icon">📅</div>
            <div class="event-date">
              ${eventDetails && eventDetails.eventDate ? (() => {
                const dateStr = typeof eventDetails.eventDate === 'string' ? eventDetails.eventDate : eventDetails.eventDate.toISOString();
                return new Date(dateStr.split('T')[0]).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              })() : 'Date coming soon - stay tuned!'}
            </div>
          </div>
        </div>
        
        <p class="footer-content">
          Your team leader <span class="highlight">${creator.name}</span> has carefully selected you to be part of this journey. 
          Access your personalized dashboard to connect with team members, view detailed event information, and track your progress.
        </p>
        
        <div class="cta-section">
          <a href="${process.env.CLIENT_URL}/events/${encodedEventName}?id=${newParticipant.eventid}" class="cta-button">
            🚀 Access Your Dashboard
          </a>
        </div>
        
        <div class="divider"></div>
        
        <p class="footer-content">
          Need assistance? Our support team is here to help you every step of the way. 
          For any questions about your team or the event, don't hesitate to reach out.
        </p>
        
        <div class="signature">
          <p class="signature-name">The UnifHub Team</p>
          <p class="signature-title">Empowering Collaboration Worldwide</p>
        </div>
      </div>
      
      <div class="footer">
        <p class="footer-text">
          &copy; ${new Date().getFullYear()} UnifHub Technologies Inc. All rights reserved.
        </p>
        <div class="footer-links">
          <a href="#" class="footer-link">Privacy Policy</a>
          <a href="#" class="footer-link">Terms of Service</a>
          <a href="#" class="footer-link">Support Center</a>
          <a href="#" class="footer-link">Unsubscribe</a>
        </div>
        <div class="social-icons">
          <a href="#" class="social-icon">f</a>
          <a href="#" class="social-icon">t</a>
          <a href="#" class="social-icon">in</a>
        </div>
        <p class="footer-text" style="margin-top: 15px; font-size: 12px;">
          This is an automated message from a monitored account. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

            // Enhanced plain text version
            const textContent = `
UnifHub - Connecting Teams, Creating Success

Hello ${recipientName},

We're excited to inform you that ${creator.name} has added you to their team for the upcoming event "${EventName}".

EVENT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Event: ${EventName}
Date: ${eventDetails && eventDetails.eventDate ? (() => {
                const dateStr = typeof eventDetails.eventDate === 'string' ? eventDetails.eventDate : eventDetails.eventDate.toISOString();
                return new Date(dateStr.split('T')[0]).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              })() : 'Coming soon'}
Team Leader: ${creator.name}

Description: ${eventDetails && eventDetails.description ? eventDetails.description : 'Join us for this exciting event!'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 ACCESS YOUR DASHBOARD:
${process.env.CLIENT_URL}/events/${encodedEventName}?id=${newParticipant.eventid}

Your team leader has carefully selected you to be part of this journey. Log in to your dashboard to connect with team members and view detailed event information.

Need help? Contact our support team anytime.

Best regards,
The UnifHub Team
Empowering Collaboration Worldwide

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
© ${new Date().getFullYear()} UnifHub Technologies Inc. All rights reserved.
This is an automated message. Please do not reply directly to this email.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

            const notificationItem = {
              type: 'confim',
              title: `Confirmation for '${EventName}'`,
              message: `${userDoc.name} You've Been Added to a Team in ${EventName}`,
              time: new Date(),
              read: false,
              avatar: '👨‍💼',
              icon: "UserPlus",
              link: `/events/${encodedEventName}?id=${newParticipant.eventid}`
            }
            await HandleSendNotificationOnPlatfrom(notificationItem, userDoc)
            // Send the email with both HTML and plain text versions
            await SendMail.SendMailHTML(recipientEmail, senderEmail, subject, textContent, htmlContent);


          } catch (userError) {
            console.error(`Error processing notification for user ${participant.id}:`, userError);
            // Continue with other participants even if one fails
          }
        }
        else {
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

    return { success: true, message: "Team created and notifications sent" };

  } catch (error) {
    throw new Error("Failed to send team notifications");
  }
};


const HandleAcceptParticipants = async (req, res) => {
  try {
    const { eventid, teamName } = req.body;

    // Validate required fields
    if (!eventid || !teamName) {
      return res.status(400).json({ message: "Event ID and team name are required" });
    }

    // Check if event exists
    const event = await Event.findById(eventid);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const encodedEventName = encodeURIComponent(event.eventName);

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

    const actionUser = user.name;

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

    const organization = await Organization.findById(event.organization_id);
    const orgName = organization ? organization.name : "Unknown organization";

    await addUserAchievement(req.user.id, {
      title: `Registered for '${event.eventName}'`,
      description: `Registered ${event.eventName} organized by ${orgName}.`,
      metrics: {
        achievementType: 'event_registration',
        eventId: eventid,
        organizationId: event.organization_id
      }
    });

    await updateUserActivityAfterEvent(req.user.id);

    await participant.save();


    for (const element of verifyTeam.participant_id) {
      const userid = element.id;
      const user = await User.findById(userid);
      console.log("for email inside for loop", user, userid, element)
      const userEmail = user.email;
      const senderEmail = process.env.ADMIN_EMAIL;
      const subject = `🎉 Team Invitation Accepted for "${event.eventName}"`;
      const text = `
Hello ${user.name},

Excellent news! ${actionUser} has successfully joined your team "${verifyTeam.teamName}" for ${event.eventName}.

Your team roster is now complete and ready for action. We recommend connecting with your new team member to align on strategy and preparation.

Access your team dashboard: ${process.env.CLIENT_URL}/events/${encodeURIComponent(event.eventName.replace(/\s+/g, '-').toLowerCase())}?id=${event ? event._id : ''}

Best regards,
The UnifHub Team

---
UnifHub Technologies Inc.
Building Tomorrow's Teams Today
support@unifhub.com | www.unifhub.com
`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Team Update - UnifHub</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #2c3e50;
      background-color: #f8f9fa;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .email-wrapper {
      width: 100%;
      background-color: #f8f9fa;
      padding: 20px 0;
      min-height: 100vh;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      border: 1px solid #e9ecef;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 32px 40px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="40" r="1.5" fill="rgba(255,255,255,0.08)"/><circle cx="40" cy="70" r="1" fill="rgba(255,255,255,0.06)"/></svg>');
      opacity: 0.3;
    }
    
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }
    
    .tagline {
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    
    .content {
      padding: 48px 40px;
    }
    
    .greeting {
      font-size: 24px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 24px;
      letter-spacing: -0.3px;
    }
    
    .intro-text {
      font-size: 16px;
      color: #5a6c7d;
      margin-bottom: 32px;
      line-height: 1.7;
    }
    
    .highlight {
      color: #667eea;
      font-weight: 600;
    }
    
    .success-card {
      background: linear-gradient(135deg, #f8fff9 0%, #e8f8ea 100%);
      border: 2px solid #28a745;
      border-radius: 12px;
      padding: 32px 28px;
      margin: 32px 0;
      position: relative;
      overflow: hidden;
    }
    
    .success-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: #28a745;
    }
    
    .success-header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .success-icon {
      width: 48px;
      height: 48px;
      background: #28a745;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      font-size: 20px;
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
    }
    
    .success-title {
      font-size: 20px;
      font-weight: 700;
      color: #2c3e50;
      margin: 0;
    }
    
    .member-info {
      background: rgba(255, 255, 255, 0.8);
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    
    .member-name {
      font-size: 18px;
      font-weight: 700;
      color: #2c3e50;
      margin-bottom: 4px;
    }
    
    .member-action {
      color: #28a745;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .event-details {
      margin-top: 24px;
    }
    
    .event-name {
      font-size: 18px;
      font-weight: 700;
      color: #2c3e50;
      margin-bottom: 12px;
    }
    
    .event-info {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      font-size: 14px;
      color: #5a6c7d;
    }
    
    .event-info-icon {
      margin-right: 8px;
      font-size: 16px;
    }
    
    .motivation-text {
      background: rgba(102, 126, 234, 0.05);
      border-radius: 8px;
      padding: 20px;
      margin: 32px 0;
      font-size: 16px;
      color: #4a5568;
      line-height: 1.7;
      border-left: 4px solid #667eea;
    }
    
    .cta-section {
      text-align: center;
      margin: 40px 0;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      letter-spacing: 0.3px;
    }
    
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
    
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #e9ecef, transparent);
      margin: 40px 0;
    }
    
    .signature {
      text-align: left;
    }
    
    .signature-name {
      font-size: 16px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 4px;
    }
    
    .signature-title {
      color: #667eea;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    
    .company-info {
      font-size: 13px;
      color: #8e9aaf;
      line-height: 1.5;
    }
    
    .footer {
      background-color: #2c3e50;
      padding: 32px 40px;
      text-align: center;
    }
    
    .footer-text {
      color: #bdc3c7;
      font-size: 13px;
      margin-bottom: 8px;
    }
    
    .footer-links {
      margin-top: 16px;
    }
    
    .footer-link {
      color: #667eea;
      text-decoration: none;
      margin: 0 12px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .footer-link:hover {
      color: #764ba2;
    }
    
    /* Mobile Responsive */
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 10px;
      }
      
      .content {
        padding: 32px 24px;
      }
      
      .header {
        padding: 24px 24px;
      }
      
      .logo {
        font-size: 28px;
      }
      
      .greeting {
        font-size: 20px;
      }
      
      .success-card {
        padding: 24px 20px;
      }
      
      .cta-button {
        padding: 14px 28px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">UnifHub</div>
        <div class="tagline">Team Management Platform</div>
      </div>
      
      <div class="content">
        <h1 class="greeting">Hello ${user.name},</h1>
        
        <p class="intro-text">
          We're excited to share some excellent news about your team <span class="highlight">"${verifyTeam.teamName}"</span> 
          for the upcoming <span class="highlight">"${event.eventName}"</span> event.
        </p>
        
        <div class="success-card">
          <div class="success-header">
            <div class="success-icon">✅</div>
            <h2 class="success-title">Team Member Successfully Added</h2>
          </div>
          
          <div class="member-info">
            <div class="member-name">${actionUser}</div>
            <div class="member-action">Accepted Team Invitation</div>
          </div>
          
          <div class="event-details">
            <div class="event-name">${event.eventName}</div>
            <div class="event-info">
              <span class="event-info-icon">👥</span>
              <span><strong>Team:</strong> ${verifyTeam.teamName}</span>
            </div>
            <div class="event-info">
              <span class="event-info-icon">📅</span>
              <span><strong>Date:</strong> ${event && event.eventDate ? (() => {
          const dateStr = typeof event.eventDate === 'string' ? event.eventDate : event.eventDate.toISOString();
          return new Date(dateStr.split('T')[0]).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        })() : 'Date coming soon'}</span>
            </div>
          </div>
        </div>
        
        <div class="motivation-text">
          <strong>Your team is now stronger than ever!</strong> We recommend reaching out to your new team member to discuss strategy, coordinate preparation efforts, and establish clear communication channels for optimal performance.
        </div>
        
        <div class="cta-section">
          <a href="${process.env.CLIENT_URL}/events/${encodeURIComponent(event.eventName.replace(/\s+/g, '-').toLowerCase())}?id=${event ? event._id : ''}" class="cta-button">
            🚀 Access Team Dashboard
          </a>
        </div>
        
        <div class="divider"></div>
        
        <div class="signature">
          <p class="signature-name">The UnifHub Team</p>
          <p class="signature-title">Building Tomorrow's Teams Today</p>
          <div class="company-info">
            UnifHub Technologies Inc.<br>
            Enterprise Team Management Solutions<br>
            <a href="mailto:support@unifhub.com" style="color: #667eea;">support@unifhub.com</a> | 
            <a href="https://unifhub.com" style="color: #667eea;">www.unifhub.com</a>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p class="footer-text">
          &copy; ${new Date().getFullYear()} UnifHub Technologies Inc. All rights reserved.
        </p>
        <p class="footer-text">
          This is an automated notification from our secure team management system.
        </p>
        <div class="footer-links">
          <a href="#" class="footer-link">Privacy Policy</a>
          <a href="#" class="footer-link">Terms of Service</a>
          <a href="#" class="footer-link">Contact Support</a>
          <a href="#" class="footer-link">Unsubscribe</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
      await SendMail.SendMailHTML(userEmail, senderEmail, subject, text, html)
       if (element.id !== req.user.id) {
        const notificationItem = {
          type: 'congratulation',
          title: `Acceptions for '${event.eventName}'`,
          message: `${actionUser} have Been Accepted to a Team in ${event.eventName}`,
          time: new Date(),
          read: false,
          avatar: '👨‍💼',
          icon: "PartyPopper",
          link: `/events/${encodedEventName}?id=${event._id}`
        }
        await handleSendNotificationtoParticipants(notificationItem, element)
      }

    };



    res.status(200).json({
      message: "Participant verified successfully",
      participant: participant
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify participant", error: error.message });
  }
};


const HandleRejectParticipants = async (req, res) => {
  try {
    const { eventid, teamName } = req.body;

    // Validate inputs
    if (!eventid || !teamName) {
      return res.status(400).json({ message: "Event ID and team name are required" });
    }

    // Fetch event and team
    const event = await Event.findById(eventid);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const encodedEventName = encodeURIComponent(event.eventName);

    const verifyTeam = await ParticipantsVerify.findOne({ eventid, teamName });
    if (!verifyTeam) {
      return res.status(404).json({ message: "Team not found" });
    }

    const participantIndex = verifyTeam.participant_id.findIndex(p => p.id === req.user.id);
    if (participantIndex === -1) {
      return res.status(400).json({ message: "User not found in team" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const actionUser = user.name

    // Remove participant from verification list
    if (verifyTeam.participant_id.length === 1) {
      await ParticipantsVerify.deleteOne({ eventid, teamName });
    } else {
      await ParticipantsVerify.updateOne(
        { eventid, teamName },
        { $pull: { participant_id: { id: req.user.id } } }
      );
    }

    // Send email to all remaining team members
    for (const element of verifyTeam.participant_id) {
      if (element.id !== req.user.id) {
        const teammate = await User.findById(element.id);
        if (!teammate) continue;

        const userEmail = teammate.email;
        const senderEmail = process.env.ADMIN_EMAIL;
        const subject = `Team Update Required - ${event.eventName} | UnifHub`;

        const text = `
Hello ${teammate.name},

We're writing to inform you of an update regarding your team "${teamName}" for ${event.eventName}.

${user.name} has declined the invitation to join your team at this time. This means you'll need to consider alternative team arrangements or invite additional members to meet event requirements.

We recommend reviewing your team composition and taking appropriate action through your dashboard.

Access your team management tools: ${process.env.CLIENT_URL}/events/${encodeURIComponent(event.eventName.replace(/\s+/g, '-').toLowerCase())}?id=${event ? event._id : ''}

Best regards,
The UnifHub Team

---
UnifHub Technologies Inc.
Building Tomorrow's Teams Today
support@unifhub.com | www.unifhub.com
`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Team Update - UnifHub</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #2c3e50;
      background-color: #f8f9fa;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .email-wrapper {
      width: 100%;
      background-color: #f8f9fa;
      padding: 20px 0;
      min-height: 100vh;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      border: 1px solid #e9ecef;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 32px 40px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="40" r="1.5" fill="rgba(255,255,255,0.08)"/><circle cx="40" cy="70" r="1" fill="rgba(255,255,255,0.06)"/></svg>');
      opacity: 0.3;
    }
    
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }
    
    .tagline {
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    
    .content {
      padding: 48px 40px;
    }
    
    .greeting {
      font-size: 24px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 24px;
      letter-spacing: -0.3px;
    }
    
    .intro-text {
      font-size: 16px;
      color: #5a6c7d;
      margin-bottom: 32px;
      line-height: 1.7;
    }
    
    .highlight {
      color: #667eea;
      font-weight: 600;
    }
    
    .notification-card {
      background: linear-gradient(135deg, #fff8f1 0%, #fef3e8 100%);
      border: 2px solid #f39c12;
      border-radius: 12px;
      padding: 32px 28px;
      margin: 32px 0;
      position: relative;
      overflow: hidden;
    }
    
    .notification-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: #f39c12;
    }
    
    .notification-header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .notification-icon {
      width: 48px;
      height: 48px;
      background: #f39c12;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      font-size: 20px;
      box-shadow: 0 4px 12px rgba(243, 156, 18, 0.3);
      color: white;
    }
    
    .notification-title {
      font-size: 20px;
      font-weight: 700;
      color: #2c3e50;
      margin: 0;
    }
    
    .member-info {
      background: rgba(255, 255, 255, 0.9);
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    
    .member-name {
      font-size: 18px;
      font-weight: 700;
      color: #2c3e50;
      margin-bottom: 4px;
    }
    
    .member-action {
      color: #f39c12;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .event-details {
      margin-top: 24px;
    }
    
    .event-name {
      font-size: 18px;
      font-weight: 700;
      color: #2c3e50;
      margin-bottom: 12px;
    }
    
    .event-info {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      font-size: 14px;
      color: #5a6c7d;
    }
    
    .event-info-icon {
      margin-right: 8px;
      font-size: 16px;
    }
    
    .action-required {
      background: rgba(102, 126, 234, 0.05);
      border-radius: 8px;
      padding: 24px;
      margin: 32px 0;
      border-left: 4px solid #667eea;
    }
    
    .action-title {
      font-size: 18px;
      font-weight: 700;
      color: #2c3e50;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
    }
    
    .action-icon {
      margin-right: 8px;
      font-size: 20px;
    }
    
    .action-text {
      font-size: 16px;
      color: #4a5568;
      line-height: 1.7;
      margin-bottom: 16px;
    }
    
    .action-list {
      list-style: none;
      padding: 0;
    }
    
    .action-item {
      padding: 8px 0;
      color: #5a6c7d;
      font-size: 15px;
      position: relative;
      padding-left: 24px;
    }
    
    .action-item::before {
      content: '•';
      color: #667eea;
      font-weight: bold;
      position: absolute;
      left: 8px;
    }
    
    .cta-section {
      text-align: center;
      margin: 40px 0;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      letter-spacing: 0.3px;
    }
    
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
    
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #e9ecef, transparent);
      margin: 40px 0;
    }
    
    .signature {
      text-align: left;
    }
    
    .signature-name {
      font-size: 16px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 4px;
    }
    
    .signature-title {
      color: #667eea;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    
    .company-info {
      font-size: 13px;
      color: #8e9aaf;
      line-height: 1.5;
    }
    
    .footer {
      background-color: #2c3e50;
      padding: 32px 40px;
      text-align: center;
    }
    
    .footer-text {
      color: #bdc3c7;
      font-size: 13px;
      margin-bottom: 8px;
    }
    
    .footer-links {
      margin-top: 16px;
    }
    
    .footer-link {
      color: #667eea;
      text-decoration: none;
      margin: 0 12px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .footer-link:hover {
      color: #764ba2;
    }
    
    /* Mobile Responsive */
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 10px;
      }
      
      .content {
        padding: 32px 24px;
      }
      
      .header {
        padding: 24px 24px;
      }
      
      .logo {
        font-size: 28px;
      }
      
      .greeting {
        font-size: 20px;
      }
      
      .notification-card {
        padding: 24px 20px;
      }
      
      .cta-button {
        padding: 14px 28px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="logo">UnifHub</div>
        <div class="tagline">Team Management Platform</div>
      </div>
      
      <div class="content">
        <h1 class="greeting">Hello ${teammate.name},</h1>
        
        <p class="intro-text">
          We're writing to inform you of an important update regarding your team <span class="highlight">"${teamName}"</span> 
          for the upcoming <span class="highlight">"${event.eventName}"</span> event.
        </p>
        
        <div class="notification-card">
          <div class="notification-header">
            <div class="notification-icon">⚠️</div>
            <h2 class="notification-title">Team Invitation Status Update</h2>
          </div>
          
          <div class="member-info">
            <div class="member-name">${user.name}</div>
            <div class="member-action">Declined Team Invitation</div>
          </div>
          
          <div class="event-details">
            <div class="event-name">${event.eventName}</div>
            <div class="event-info">
              <span class="event-info-icon">👥</span>
              <span><strong>Team:</strong> ${teamName}</span>
            </div>
            <div class="event-info">
              <span class="event-info-icon">📅</span>
              <span><strong>Date:</strong> ${event && event.eventDate ? (() => {
            const dateStr = typeof event.eventDate === 'string' ? event.eventDate : event.eventDate.toISOString();
            return new Date(dateStr.split('T')[0]).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          })() : 'Date coming soon'}</span>
            </div>
          </div>
        </div>
        
        <div class="action-required">
          <h3 class="action-title">
            <span class="action-icon">🎯</span>
            Next Steps Required
          </h3>
          <p class="action-text">
            Since ${user.name} has declined to join your team, you'll need to adjust your team composition to ensure you meet the event requirements.
          </p>
          <ul class="action-list">
            <li class="action-item">Review your current team roster and requirements</li>
            <li class="action-item">Consider inviting additional qualified team members</li>
            <li class="action-item">Verify that your team meets minimum participation criteria</li>
            <li class="action-item">Update your team strategy if necessary</li>
          </ul>
        </div>
        
        <div class="cta-section">
          <a href="${process.env.CLIENT_URL}/events/${encodeURIComponent(event.eventName.replace(/\s+/g, '-').toLowerCase())}?id=${event ? event._id : ''}" class="cta-button">
            🔧 Manage Team Settings
          </a>
        </div>
        
        <div class="divider"></div>
        
        <div class="signature">
          <p class="signature-name">The UnifHub Team</p>
          <p class="signature-title">Building Tomorrow's Teams Today</p>
          <div class="company-info">
            UnifHub Technologies Inc.<br>
            Enterprise Team Management Solutions<br>
            <a href="mailto:support@unifhub.com" style="color: #667eea;">support@unifhub.com</a> | 
            <a href="https://unifhub.com" style="color: #667eea;">www.unifhub.com</a>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p class="footer-text">
          &copy; ${new Date().getFullYear()} UnifHub Technologies Inc. All rights reserved.
        </p>
        <p class="footer-text">
          This is an automated notification from our secure team management system.
        </p>
        <div class="footer-links">
          <a href="#" class="footer-link">Privacy Policy</a>
          <a href="#" class="footer-link">Terms of Service</a>
          <a href="#" class="footer-link">Contact Support</a>
          <a href="#" class="footer-link">Unsubscribe</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

        if (element.id === req.user.id) {
          const notificationItem = {
            type: 'reject',
            title: `Reject for '${event.eventName}'`,
            message: `You have Been Reject to be Part of Team in ${event.eventName}`,
            time: new Date(),
            read: false,
            avatar: '👨‍💼',
            icon: "XCircle",
            link: `/events/${encodedEventName}?id=${event._id}`
          }
          await handleSendNotificationtoParticipants(notificationItem, element)
        } else {
          const notificationItem = {
            type: 'reject',
            title: `Reject for '${event.eventName}'`,
            message: `${actionUser} have Been Reject to be Part of Team in ${event.eventName}`,
            time: new Date(),
            read: false,
            avatar: '👨‍💼',
            icon: "XCircle",
            link: `/events/${encodedEventName}?id=${event._id}`
          }
          await handleSendNotificationtoParticipants(notificationItem, element)
        }

        await SendMail.SendMailHTML(userEmail, senderEmail, subject, text, html);
      }
    }

    res.status(200).json({
      message: "Participant rejection processed successfully",
      rejectedUser: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      eventName: event.eventName,
      teamName: teamName
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to reject participant",
      error: error.message
    });
  }
};


const HandleAddParticipants = async (req, res) => {
  try {
    const { eventid, participant_ids, teamName } = req.body;
    // Check if event exists
    const event = await Event.findById(eventid);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const encodedEventName = encodeURIComponent(event.eventName);


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

    // Get organization details for achievement tracking
    const organization = await Organization.findById(event.organization_id);
    const orgName = organization ? organization.name : "Unknown organization";

    await Promise.all(
      formattedParticipants.map(async (participant) => {
        if (req.user.id == participant.id) {
          const newParticipant = new Participants({
            eventid,
            teamName,
            participant_id: [participant],
            position: 0 // Default position
          });

          // Add achievement for registering for the event
          await addUserAchievement(req.user.id, {
            title: `Registered for '${event.eventName}'`,
            description: `Registered ${event.eventName} organized by ${orgName}.`,
            metrics: {
              achievementType: 'event_registration',
              eventId: eventid,
              organizationId: event.organization_id
            }
          });

          // Update user activity score
          await updateUserActivityAfterEvent(req.user.id);
          

          // const notificationItem = {
          //   type: 'congratulation',
          //   title: `Register from '${event.eventName}'`,
          //   message: `You have been Register from a team in ${event.eventName}.`,
          //   time: new Date(),
          //   read: false,
          //   avatar: '👨‍💼',
          //   icon: "Register",
          //   link: `/events/${encodedEventName}?id=${event._id}`
          // };

          // await handleSendNotificationtoParticipants(notificationItem, participant)
          await newParticipant.save();
          console.log("after working")
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



    // Update each user's event list and add achievement for joining event
    await Promise.all(
      userIds.map(async (id) => {
        const user = await User.findById(id);
        if (user && !user.events.some(e => e.eventid.toString() === eventid)) {
          // Add event to user's event list
          user.events.push({ eventid, position: 0 });
          await user.save();
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


    // Validate event exists
    const event = await Event.findById(eventid);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Extract only the date part (YYYY-MM-DD) from eventDate and current date
    const eventDate = event.eventDate.toISOString().slice(0, 10);
    const currentDate = new Date().toISOString().slice(0, 10);

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
  HandleAcceptParticipants,
  HandleGetVerifyedParticipantsByUserId,
  HandleRejectParticipants
}