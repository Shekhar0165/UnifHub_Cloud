const mongoose = require("mongoose");

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    userid:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true,
    },
    university: { type: String, trim: true },
    bio: { type: String, trim: true },
    location: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, trim: true },
    profileImage: {
        type: String,
        default:"https://res.cloudinary.com/dt9kpgtli/image/upload/v1750145996/users/plwv3hcxswbdehv9wtbd.jpg"
    },
    coverImage: { type: String, trim: true },
    rating: { 
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },

    upcomingEvents: [
        {
            title: { type: String, required: true },
            date: { type: Date, required: true },  // Changed to Date type
            organizer: { type: String, required: true },
            location: { type: String, required: true }
        }
    ],

    events: [
        {
            title: { type: String, required: true },
            position: [{ type: String }],
            date: { type: Date, required: true },  // Changed to Date type
            participants: { type: Number, default: 0 },
            team: [{ type: Map, of: String }]
        }
    ],

    activities: {
        thisMonth: { type: Number, default: 0 },
        lastMonth: { type: Number, default: 0 },
        thisYear: { type: Number, default: 0 },
        contributionData: [[Number]],
        streakDays: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        contributions: [{ type: Number, default: 0 }]
    },

    teams: [
        {
            name: { type: String, required: true },
            head: { type: String, required: true },
            members: [{ type: Map, of: String }]
        }
    ],

    socialLinks: { type: Map, of: String },  // Optimized social links

}, { timestamps: true });

const Organization = mongoose.model("Organization", OrganizationSchema);

module.exports = Organization;
