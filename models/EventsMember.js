const mongoose = require("mongoose");

const EventMemberSchema = new mongoose.Schema({
    organizationId: {
        type: String,
        required: true
    },
    eventId: {
        type: String,
        required: true
    },
    eventHead: {
        type: String,
        required: true // Fixed spelling
    },
    eventViceHead: {
        type: String
    },
    eventTeams: [{
        teamId: {
            type: String,
            required: true
        },
        teamName: {
            type: String,
            required: true
        },
        members: [{
            type: String,
            required: true
        }]
    }],
    position: {
        type: Number,
        required: false
    }
}, { timestamps: true });

const EventMember = mongoose.model("EventMember", EventMemberSchema);

module.exports = EventMember;
