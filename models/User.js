const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    userid:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    university: {
        type: String
    },
    bio: {
        type: String
    },
    location: {
        type: String
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String
    },
    // Add OTP field to store verification codes
    otp: {
        code: String,
        expiresAt: Date
    },
    profileImage: {
        type: String
    },
    // Rest of your schema remains the same...
    coverImage: {
        type: String
    },
    upcomingEvents: [
        {
            title: String,
            date: String,
            organizer: String,
            location: String,
            status: String
        }
    ],
    events: [
        {
            eventid: String,
            position: String,
        }
    ],
    skills: [String],
    education: [
        {
            institution: String,
            degree: String,
            duration: String
        }
    ],
    experience: [
        {
            company: String,
            role: String,
            duration: String,
            description: String
        }
    ],
    activities: {
        thisMonth: Number,
        lastMonth: Number,
        thisYear: Number,
        contributionData: [[Number]],
        streakDays: Number,
        longestStreak: Number,
        contributions: [Number]
    },
    socialLinks: {
        github: String,
        linkedin: String,
        twitter: String
    },
    refreshToken:{
        type:String
    }
});

module.exports = mongoose.model('User', UserSchema);