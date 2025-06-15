const User = require('../../models/User');
const Organization = require('../../models/Organizations');
const Event = require('../../models/Event');
const Participants = require('../../models/Participants');

const HandlGetUserEventsList = async (req, res) => {
    try {
        const { id } = req.params;

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


module.exports = { HandlGetUserEventsList }