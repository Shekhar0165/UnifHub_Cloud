const Event = require("../../models/Event");
const User = require("../../models/User");
const Organization = require("../../models/Organizations");
const mongoose = require("mongoose");
const { addFirstEventAchievement } = require("./OrganizationJourney");
const { addEventScore } = require("./OrganizationActivity");
const Participants = require("../../models/Participants");
const CloudinaryConfig = require('../../config/CloudinaryConfig');
const fs = require('fs').promises;

const HandleAddEvent = async (req, res) => {
    try {
        const {
            organization_id, eventName, description, content,
            eventDate, time, venue, category,
            maxTeamMembers, minTeamMembers
        } = req.body;        // Check if a file was uploaded
        let image_path = "";
        if (req.file) {
            // Upload to Cloudinary
            const result = await CloudinaryConfig.uploadFile(req.file, 'events');
            if (!result.success) {
                throw new Error('Failed to upload image to Cloudinary');
            }
            image_path = result.url;
            // Delete local file after upload
            await fs.unlink(req.file.path);
        }

        // Validate input
        if (!organization_id || !eventName || !eventDate || !venue || !category || !maxTeamMembers || !minTeamMembers) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        if (maxTeamMembers < minTeamMembers) {
            return res.status(400).json({ message: "maxTeamMembers cannot be less than minTeamMembers" });
        }

        // Check if the organization exists
        const organization = await Organization.findById(organization_id);
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Determine event status
        const currentDate = new Date();
        const eventStatus = new Date(eventDate) < currentDate ? "past" : "upcoming";

        const newEvent = new Event({
            organization_id: organization_id, 
            eventName, 
            description, 
            content, 
            image_path, // S3 URL 
            eventDate, 
            time, 
            venue, 
            category,
            maxTeamMembers, 
            minTeamMembers,
            status: eventStatus,
            totalparticipants: 0,
            totalteams: 0,
            organizer: organization.name,
        });

        await newEvent.save();

        // Check if this is the organization's first event and add achievement
        const eventCount = await Event.countDocuments({ organization_id });
        if (eventCount === 1) {
            // Add first event achievement (don't wait for it to complete)
            addFirstEventAchievement(organization_id)
                .then(result => {
                    if (result) {
                        console.log(`First event achievement added for organization ${organization_id}`);
                    }
                })
                .catch(err => {
                    console.error("Error adding first event achievement:", err);
                });
        }

        // Update organization activity score
        try {
            await addEventScore(organization_id, newEvent);
            console.log(`Organization activity score updated for new event ${newEvent._id}`);
        } catch (err) {
            console.error("Error updating organization activity score:", err);
        }

        res.status(201).json({ message: "Event created successfully", event: newEvent });
    } catch (error) {
        res.status(500).json({ message: "Error creating event", error: error.message });
    }
};

const HandleUpdateEvents = async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: "Invalid event ID" });
        }

        // First, get the existing event to check if it has an image
        const existingEvent = await Event.findById(eventId);
        if (!existingEvent) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Extract fields from req.body
        const updatedData = { ...req.body };        // If a new file was uploaded, upload to Cloudinary and update the path
        if (req.file) {
            // Delete old image from Cloudinary if exists
            if (existingEvent.image_path) {
                const publicId = existingEvent.image_path.split('/').pop().split('.')[0];
                if (publicId) {
                    console.log("Deleting old image from Cloudinary:", publicId);
                    await CloudinaryConfig.deleteFile(publicId);
                }
            }
            
            // Upload new image to Cloudinary
            const result = await CloudinaryConfig.uploadFile(req.file, 'events');
            if (!result.success) {
                throw new Error('Failed to upload image to Cloudinary');
            }
            updatedData.image_path = result.url;
            // Delete local file after upload
            await fs.unlink(req.file.path);
        }

        const updatedEvent = await Event.findByIdAndUpdate(eventId, updatedData, { new: true });

        res.status(200).json({ message: "Event updated successfully", event: updatedEvent });
    } catch (error) {
        console.error("Error updating event:", error);
        res.status(500).json({ message: "Error updating event", error: error.message });
    }
};

// Delete an event
const HandleDeleteEvents = async (req, res) => {
    try {
        const { eventId } = req.params;
        const authId = req.user.id;
        
        if(!authId){
            return res.status(400).json({ message: "Invalid user ID" });
        }

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: "Invalid event ID" });
        }

        const organization = await Organization.findById(authId);
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Check if the event belongs to the organization
        const checkedEvent = await Event.find({ _id: eventId, organization_id: authId });
        if (checkedEvent.length === 0) {
            return res.status(404).json({ message: "Event not found for this organization" });
        }        if(checkedEvent[0].image_path) {
            console.log("checkedEvent[0].image_path", checkedEvent[0].image_path);
            const publicId = checkedEvent[0].image_path.split('/').pop().split('.')[0];
            if (publicId) {
                console.log("Deleting image from Cloudinary:", publicId);
                await CloudinaryConfig.deleteFile(publicId);
            }
        }



        await Event.findByIdAndDelete(eventId);

        const updatedEvents = await Event.find(); // Fetch remaining events
        return res.status(200).json(updatedEvents); // Return updated events list
    } catch (error) {
        console.error("Error deleting event:", error);
        return res.status(500).json({ message: "Failed to delete event" });
    }
};

;

// Get all events
const HandleGetAllEvents = async (req, res) => {
    try {
        const events = await Event.find()
            .populate("organization_id")

        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: "Error fetching events", error: error.message });
    }
};

const HandleGetEventByOrganization = async (req, res) => {
    try {
        const {_id}  = req.body;
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({ message: "Invalid organization ID" });
        }

        const events = await Event.find({organization_id:_id })
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: "Error fetching events", error: error.message });
    }
}

const HandleGetOneEvent = async (req, res) => {
    try {
        const {_id}  = req.body;
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({ message: "Invalid organization ID" });
        }
        console.log("start")

        const events = await Event.find({_id})
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: "Error fetching event", error: error.message });
    }
};

// Register user for an event
const HandleRegisterForEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { userId, teamName, teamMembers } = req.body;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: "Invalid event ID" });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if user is already registered
        const alreadyRegistered = event.registrations.some(reg => 
            reg.userId && reg.userId.toString() === userId
        );

        if (alreadyRegistered) {
            return res.status(400).json({ message: "User already registered for this event" });
        }

        // Add registration
        const newRegistration = {
            userId,
            teamName,
            teamMembers,
            registrationDate: new Date()
        };

        event.registrations.push(newRegistration);
        event.totalparticipants += 1;
        if (teamName) {
            event.totalteams += 1;
        }

        await event.save();

        res.status(200).json({ message: "Successfully registered for event", event });
    } catch (error) {
        res.status(500).json({ message: "Error registering for event", error: error.message });
    }
};

const HandleUPComingEventsForUser = async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log("userId", userId);

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        // Find participants where the user is listed
        const participants = await Participants.find({
            "participant_id.id": userId
        });

        if (!participants || participants.length === 0) {
            return res.status(404).json({ message: "No upcoming events found" });
        }

        // Extract event IDs
        const eventIds = participants.map(p => p.eventid);
        
        // Find events based on extracted event IDs
        const events = await Event.find({ _id: { $in: eventIds } });

        if (!events || events.length === 0) {
            return res.status(404).json({ message: "No events found" });
        }

        console.log("events", events);

        // Format event data for frontend
        const upcomingEvents = events.map(event => ({
            title: event.eventName,
            status: "Registered", // You can modify this based on participant data
            date: event.eventDate,
            location: event.venue,
            organizer: event.organizer,
        }));

        res.json({ upcomingEvents });
    } catch (error) {
        res.status(500).json({ message: "Error fetching events", error: error.message });
    }
};


module.exports = {
    HandleAddEvent,
    HandleUpdateEvents,
    HandleDeleteEvents,
    HandleGetAllEvents,
    HandleRegisterForEvent,
    HandleGetEventByOrganization,
    HandleGetOneEvent,
    HandleUPComingEventsForUser
};
