const Post = require('../../models/Post');
const User = require('../../models/User');
const bcrypt = require('bcrypt');
const CloudinaryConfig = require('../../config/CloudinaryConfig');
const fs = require('fs').promises;

// Get a user by ID or email
const HandleGetUser = async (req, res) => {
  try {
    const id = req.user.id; // Authenticated user's ID'
    console.log('Authenticated User ID:', id);

    // Correct query to find user by ID
    const user = await User.findOne({ _id: id }).select('-password -refreshToken -otp');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const HandleGetForProfile = async (req, res) => {
  try {
    const id = req.params.userid; // Authenticated user's ID'

    // Correct query to find user by ID
    const user = await User.findOne({ userid: id }).select('-password -refreshToken -otp');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    console.log(user)
    res.status(200).json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const HandleSearchUser = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query?.trim()) {
      return res.status(400).json({ success: false, message: "Search query is required." });
    }

    // Search users by `userid` or `name` using case-insensitive regex (starts with)
    const members = await User.find(
      {
        $or: [
          { userid: { $regex: `^${query}`, $options: "i" } },
          { name: { $regex: `^${query}`, $options: "i" } }
        ]
      }
    ).limit(10);

    return res.status(200).json({ success: true, members });
  } catch (error) {
    console.error("Search error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Helper function to extract S3 key from a URL
const extractS3KeyFromUrl = (url) => {
  if (!url) return null;
  
  const urlParts = url.split('.com/');
  if (urlParts.length > 1) {
    return urlParts[1];
  }
  return null;
};

// Update user information
const HanldeUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current user data first to check for existing images
    const currentUser = await User.findById(id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Parse the userData from FormData
    let updates = {};
    if (req.body.userData) {
      updates = JSON.parse(req.body.userData);
    } else {
      updates = { ...req.body };
    }    // Handle file uploads and delete old files
    if (req.files) {
      // Handle profile image update
      if (req.files.profileImage) {
        // Delete old profile image if exists
        if (currentUser.profileImage) {
          const publicId = currentUser.profileImage.split('/').pop().split('.')[0];
          if (publicId) {
            console.log("Deleting old profile image from Cloudinary:", publicId);
            await CloudinaryConfig.deleteFile(publicId);
          }
        }
        // Upload new profile image to Cloudinary
        const profileResult = await CloudinaryConfig.uploadFile(req.files.profileImage[0], 'users');
        if (!profileResult.success) {
          throw new Error('Failed to upload profile image to Cloudinary');
        }
        updates.profileImage = profileResult.url;
        // Delete local file
        await fs.unlink(req.files.profileImage[0].path);
      }
      
      // Handle cover image update
      if (req.files.coverImage) {
        // Delete old cover image if exists
        if (currentUser.coverImage) {
          const publicId = currentUser.coverImage.split('/').pop().split('.')[0];
          if (publicId) {
            console.log("Deleting old cover image from Cloudinary:", publicId);
            await CloudinaryConfig.deleteFile(publicId);
          }
        }
        // Upload new cover image to Cloudinary
        const coverResult = await CloudinaryConfig.uploadFile(req.files.coverImage[0], 'users');
        if (!coverResult.success) {
          throw new Error('Failed to upload cover image to Cloudinary');
        }
        updates.coverImage = coverResult.url;
        // Delete local file
        await fs.unlink(req.files.coverImage[0].path);
      }
    }

    // Don't allow direct password updates through this route
    if (updates.password) {
      delete updates.password;
    }

    // Don't allow updating email without verification
    if (updates.email) {
      delete updates.email;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken -otp');

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a user
const HandleDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Find user before deletion to get image paths
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }    // Delete profile image from Cloudinary if exists
    if (user.profileImage) {
      const publicId = user.profileImage.split('/').pop().split('.')[0];
      if (publicId) {
        console.log("Deleting profile image from Cloudinary:", publicId);
        await CloudinaryConfig.deleteFile(publicId);
      }
    }

    // Delete cover image from Cloudinary if exists
    if (user.coverImage) {
      const publicId = user.coverImage.split('/').pop().split('.')[0];
      if (publicId) {
        console.log("Deleting cover image from Cloudinary:", publicId);
        await CloudinaryConfig.deleteFile(publicId);
      }
    }

    // Delete user from database
    await User.findByIdAndDelete(id);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update password with verification
const HandleUpdatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  HandleGetUser,
  HanldeUpdateUser,
  HandleDeleteUser,
  HandleUpdatePassword,
  HandleSearchUser,
  HandleGetForProfile
};