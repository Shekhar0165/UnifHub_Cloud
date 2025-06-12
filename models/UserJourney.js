const mongoose = require("mongoose");

const UserJourneySchema = new mongoose.Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    currentOrganization: {
        name: { type: String },  
        role: { type: String },  
        startDate: { type: Date } 
    },
    workHistory: [{
        organization: {
            type: String,
            required: true
        },
        role: {
            type: String,
            required: true
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date
        },
        description: {
            type: String
        },
        rating: {
            type: Number,
            min: 1,
            max: 5
        }
    }],
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
            }
        }]
}, { timestamps: true });

module.exports = mongoose.model('UserJourney', UserJourneySchema);
