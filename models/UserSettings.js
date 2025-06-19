const mongoose = require("mongoose");

const UserSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true,
    },
    notifications: {
        likes: { type: Boolean, default: true },
        comments: { type: Boolean, default: true },
        follows: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        posts: { type: Boolean, default: true },
    },
    privateAccount: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

UserSettingsSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const UserSettings = mongoose.model("UserSettings", UserSettingsSchema);

module.exports = UserSettings;