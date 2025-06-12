const mongoose = require("mongoose");

const organizationJourneySchema = new mongoose.Schema({
    OrganizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    Journey: [{
        title: {
            type: String,
            required: true
        },
        Date: {
            type: Date,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        achievementType: {
            type: String,
            enum: ['registration', 'event_milestone', 'participant_milestone', 'feedback'],
            required: true
        },
        metrics: {
            eventCount: Number,
            totalParticipants: Number,
            eventId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event'
            }
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('OrganizationJourney', organizationJourneySchema);