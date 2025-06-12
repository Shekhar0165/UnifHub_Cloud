const mongoose = require("mongoose");

const EventsSchema = new mongoose.Schema({
    organization_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true
    },
    eventName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    image_path: {
        type: String,
        required: false
    },
    eventDate: {
        type: Date,
        required: true
    },
    time: {
        type: String,  
        required: true
    },
    venue: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["upcoming", "ongoing", "completed", "cancelled"],
        default: "upcoming"
    },
    maxTeamMembers: {
        type: Number,
        required: true
    },
    minTeamMembers: {
        type: Number,
        required: true
    },
    firstPrize: {
        type: String,
        required: false
    },
    secondPrize: {
        type: String,
        required: false
    },
    thirdPrize: {
        type: String,
        required: false
    },
    totalparticipants: {
        type: Number,
        required: false
    },
    totalteams: {
        type: Number,
        required: false
    },
    isteamadded: {
        type: Boolean,
        default: false
    },
    organizer:{
        type: String,
        required: true
    },
    rating: { 
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    }
}, { timestamps: true });

const Events = mongoose.model("Events", EventsSchema);

module.exports = Events;
