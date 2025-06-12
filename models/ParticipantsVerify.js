const mongoose = require("mongoose");

const ParticipantsVerifySchema = new mongoose.Schema({
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
        },
        verified:{
            type:Boolean,
            default:false
        }
    }],
    position: {
        type: Number, 
        required: false
    }
}, { timestamps: true });

const ParticipantsVerify = mongoose.model("ParticipantsVerify", ParticipantsVerifySchema);

module.exports = ParticipantsVerify;
