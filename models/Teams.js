const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema(
  {
    teamName: { type: String, required: true },
    OrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },

    teamLeader: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true },
      profile_path: { type: String },
      role: { type: String, required: true },
      userid: { type: String, required: true },
    },

    teamMembers: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: true },
        profile_path: { type: String },
        role: { type: String, required: true },
        userid: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

const Participants = mongoose.model("Team", TeamSchema);

module.exports = Participants;
