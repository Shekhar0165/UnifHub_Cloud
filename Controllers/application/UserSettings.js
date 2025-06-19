const UserSettings = require('../../models/UserSettings');

// Get user settings
const HandleGetUserSettings = async (req, res) => {
  try {
    const id = req.user.id;

    let settings = await UserSettings.findOne({ userId: id });

    if (!settings) {
      // If no settings exist, create default
      settings = await UserSettings.create({ userId: id });
    }

    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user settings', error });
  }
};

// Update likes notification
const HandleUpdateLikesNotification = async (req, res) => {
  try {
    const id = req.user.id;
    const { value } = req.body;

    const updated = await UserSettings.findOneAndUpdate(
      { userId: id },
      { $set: { 'notifications.likes': value } },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating likes notification', error });
  }
};

// Update comments notification
const HandleUpdateCommentsNotification = async (req, res) => {
  try {
    const id = req.user.id;
    const { value } = req.body;

    const updated = await UserSettings.findOneAndUpdate(
      { userId: id },
      { $set: { 'notifications.comments': value } },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating comments notification', error });
  }
};

// Update follows notification
const HandleUpdateFollowsNotification = async (req, res) => {
  try {
    const id = req.user.id;
    const { value } = req.body;

    const updated = await UserSettings.findOneAndUpdate(
      { userId: id },
      { $set: { 'notifications.follows': value } },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating follows notification', error });
  }
};

// Update messages notification
const HandleUpdateMessagesNotification = async (req, res) => {
  try {
    const id = req.user.id;
    const { value } = req.body;

    const updated = await UserSettings.findOneAndUpdate(
      { userId: id },
      { $set: { 'notifications.messages': value } },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating messages notification', error });
  }
};

// Update posts notification
const HandleUpdatePostsNotification = async (req, res) => {
  try {
    const id = req.user.id;
    const { value } = req.body;

    const updated = await UserSettings.findOneAndUpdate(
      { userId: id },
      { $set: { 'notifications.posts': value } },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating posts notification', error });
  }
};

// Update private account setting
const HandleUpdatePrivateAccount = async (req, res) => {
  try {
    const id = req.user.id;
    const { value } = req.body;

    const updated = await UserSettings.findOneAndUpdate(
      { userId: id },
      { privateAccount: value },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating private account setting', error });
  }
};

// Update online status visibility
const HandleUpdateOnlineStatus = async (req, res) => {
  try {
    const id = req.user.id;
    const { value } = req.body;

    const updated = await UserSettings.findOneAndUpdate(
      { userId: id },
      { showOnlineStatus: value },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating online status', error });
  }
};

const HandleEnableAllUserSettings = async (req, res) => {
  try {
    const id = req.user.id;

    console.log("usesettings",id);

    // Define all settings as true
    const defaultSettings = {
      notifications: {
        likes: true,
        comments: true,
        follows: true,
        messages: true,
        posts: true,
      },
      privateAccount: true,
      showOnlineStatus: true
    };

    console.log(defaultSettings)

    // Try to find existing settings
    // let settings = await UserSettings.findOne({ userId: id });
    // console.log(settings)

    settings = await UserSettings.create({ userId: id, ...defaultSettings });
    // if (!settings) {
    //   // If not found, create with default true settings

    //   console.log("settings in if",settings)
    // } else {
    //   // If found, update all to true
    //   settings = await UserSettings.findOneAndUpdate(
    //     { userId: id },
    //     { $set: defaultSettings },
    //     { new: true }
    //   );
    // }

    console.log("settings",settings)

    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error enabling all user settings', error });
  }
};



module.exports = {
  HandleGetUserSettings,
  HandleUpdateLikesNotification,
  HandleUpdateCommentsNotification,
  HandleUpdateFollowsNotification,
  HandleUpdateMessagesNotification,
  HandleUpdatePostsNotification,
  HandleUpdatePrivateAccount,
  HandleUpdateOnlineStatus,
  HandleEnableAllUserSettings
};
