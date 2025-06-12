const mongoose = require("mongoose");

const ParticipantSchema = new mongoose.Schema({
    eventid: {
        type: String,
        required: true
    },
    teamName:{
        type:String,
        require:true,
        unique:true
    },
    participant_id:[{
        id:{
            type: String,
            required: true
        },
        name:{
            type: String,
            required: true
        },
        userid:{
            type: String,
            required: true
        },
        profileImage:{
            tupe:String,
        }
    }],
    position: {
        type: Number, 
        required: false
    }
}, { timestamps: true });

const Participants = mongoose.model("Participants", ParticipantSchema);

module.exports = Participants;
