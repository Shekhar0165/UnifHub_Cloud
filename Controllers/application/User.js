const Post = require('../../models/Post');
const User = require('../../models/User');
const bcrypt = require('bcrypt');
const CloudinaryConfig = require('../../config/CloudinaryConfig');
const Organization = require('../../models/Organizations')
const fs = require('fs').promises;

// Get a user by ID or email
const HandleGetUser = async (req, res) => {
  try {
    const id = req.user.id; // Authenticated user's ID'

    // Correct query to find user by ID
    const user = await User.findOne({ _id: id }).select('-password -refreshToken -otp');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
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
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const HandleSearchUser = async (req, res) => {
  try {
    const { query } = req.query;
    
    // Enhanced validation
    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required.",
      });
    }


    const searchConditions = {
      $or: [
        { userid: { $regex: `^${query.trim()}`, $options: "i" } },
        { name: { $regex: `^${query.trim()}`, $options: "i" } }
      ]
    };


    // Test database connections and individual queries
    try {
      const userCount = await User.countDocuments();
      
      const orgCount = await Organization.countDocuments();
    } catch (dbError) {
      return res.status(500).json({ 
        success: false, 
        message: "Database connection error" 
      });
    }

    // Parallel search with individual error handling
    const [users, organizations] = await Promise.all([
      User.find(searchConditions)
        .limit(10)
        .lean()
        .catch(err => {
          console.error('User search error:', err);
          return [];
        }),
      Organization.find(searchConditions)
        .limit(10)
        .lean()
        .catch(err => {
          console.error('Organization search error:', err);
          return [];
        })
    ]);


    // Tag type for frontend distinction
    const userResults = users.map(user => ({ 
      ...user, 
      type: 'user',
      // Add displayName for consistency
      displayName: user.name,
      displayId: user.userid
    }));
    
    const orgResults = organizations.map(org => ({ 
      ...org, 
      type: 'organization',
      // Add displayName for consistency
      displayName: org.name,
      displayId: org.userid
    }));

    const results = [...userResults, ...orgResults];


    return res.status(200).json({ 
      success: true, 
      results,
      // Add debug info (remove in production)
      debug: {
        query: query.trim(),
        userCount: users.length,
        orgCount: organizations.length,
        totalResults: results.length
      }
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Server error",
      // Add error details in development (remove in production)
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Helper function to extract S3 key from a URL
// const extractS3KeyFromUrl = (url) => {
//   if (!url) return null;
  
//   const urlParts = url.split('.com/');
//   if (urlParts.length > 1) {
//     return urlParts[1];
//   }
//   return null;
// };

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
        await CloudinaryConfig.deleteFile(publicId);
      }
    }

    // Delete cover image from Cloudinary if exists
    if (user.coverImage) {
      const publicId = user.coverImage.split('/').pop().split('.')[0];
      if (publicId) {
        await CloudinaryConfig.deleteFile(publicId);
      }
    }

    // Delete user from database
    await User.findByIdAndDelete(id);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
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