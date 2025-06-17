const Post = require('../../models/Post');
const User = require('../../models/User');
const bcrypt = require('bcrypt');
const CloudinaryConfig = require('../../config/CloudinaryConfig');
const Organization = require('../../models/Organizations')
const fs = require('fs').promises;

// Helper function to extract public ID from Cloudinary URL
const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  try {
    // Extract public ID from Cloudinary URL
    // Example URL: https://res.cloudinary.com/your-cloud/image/upload/v1234567890/users/filename.jpg
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      // Get everything after 'upload/v{version}/'
      const pathParts = urlParts.slice(uploadIndex + 2);
      const fullPath = pathParts.join('/');
      // Remove file extension
      return fullPath.replace(/\.[^/.]+$/, '');
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting public ID from URL:', error);
    return null;
  }
};

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

const HandleSearchALL = async (req, res) => {
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

const HandleSearchUser = async (req, res) => {
  try {
    const { query } = req.query;
    console.log(query)

    // Validate the search query
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

    const users = await User.find(searchConditions)
      .limit(10)
      .lean()
      .catch(err => {
        console.error('User search error:', err);
        return [];
      });

    const userResults = users.map(user => ({
      ...user,
      type: 'user',
      displayName: user.name,
      displayId: user.userid
    }));

    return res.status(200).json({
      success: true,
      members: userResults,
      debug: {
        query: query.trim(),
        userCount: users.length
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
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
    }

    // Handle file uploads and delete old files
    if (req.files) {
      // Handle profile image update
      if (req.files.profileImage) {
        // Delete old profile image if exists
        if (currentUser.profileImage) {
          const publicId = extractPublicIdFromUrl(currentUser.profileImage);
          if (publicId) {
            try {
              await CloudinaryConfig.deleteFile(publicId);
              console.log('Old profile image deleted successfully:', publicId);
            } catch (deleteError) {
              console.error('Error deleting old profile image:', deleteError);
              // Continue with upload even if deletion fails
            }
          }
        }
        
        // Upload new profile image to Cloudinary
        const profileResult = await CloudinaryConfig.uploadFile(req.files.profileImage[0], 'users');
        if (!profileResult.success) {
          throw new Error('Failed to upload profile image to Cloudinary');
        }
        updates.profileImage = profileResult.url;
        
        // Delete local file
        try {
          await fs.unlink(req.files.profileImage[0].path);
        } catch (unlinkError) {
          console.error('Error deleting local profile image file:', unlinkError);
        }
      }
      
      // Handle cover image update
      if (req.files.coverImage) {
        // Delete old cover image if exists
        if (currentUser.coverImage) {
          const publicId = extractPublicIdFromUrl(currentUser.coverImage);
          if (publicId) {
            try {
              await CloudinaryConfig.deleteFile(publicId);
              console.log('Old cover image deleted successfully:', publicId);
            } catch (deleteError) {
              console.error('Error deleting old cover image:', deleteError);
              // Continue with upload even if deletion fails
            }
          }
        }
        
        // Upload new cover image to Cloudinary
        const coverResult = await CloudinaryConfig.uploadFile(req.files.coverImage[0], 'users');
        if (!coverResult.success) {
          throw new Error('Failed to upload cover image to Cloudinary');
        }
        updates.coverImage = coverResult.url;
        
        // Delete local file
        try {
          await fs.unlink(req.files.coverImage[0].path);
        } catch (unlinkError) {
          console.error('Error deleting local cover image file:', unlinkError);
        }
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
    }

    // Delete profile image from Cloudinary if exists
    if (user.profileImage) {
      const publicId = extractPublicIdFromUrl(user.profileImage);
      if (publicId) {
        try {
          await CloudinaryConfig.deleteFile(publicId);
          console.log('Profile image deleted successfully from Cloudinary:', publicId);
        } catch (deleteError) {
          console.error('Error deleting profile image from Cloudinary:', deleteError);
          // Continue with user deletion even if image deletion fails
        }
      }
    }

    // Delete cover image from Cloudinary if exists
    if (user.coverImage) {
      const publicId = extractPublicIdFromUrl(user.coverImage);
      if (publicId) {
        try {
          await CloudinaryConfig.deleteFile(publicId);
          console.log('Cover image deleted successfully from Cloudinary:', publicId);
        } catch (deleteError) {
          console.error('Error deleting cover image from Cloudinary:', deleteError);
          // Continue with user deletion even if image deletion fails
        }
      }
    }

    // Optional: Delete all user's posts and their associated images
    try {
      const userPosts = await Post.find({ author: id });
      
      // Delete images from posts if they exist
      for (const post of userPosts) {
        if (post.image) {
          const publicId = extractPublicIdFromUrl(post.image);
          if (publicId) {
            try {
              await CloudinaryConfig.deleteFile(publicId);
              console.log('Post image deleted successfully:', publicId);
            } catch (deleteError) {
              console.error('Error deleting post image:', deleteError);
            }
          }
        }
      }
      
      // Delete all user's posts
      await Post.deleteMany({ author: id });
      console.log('All user posts deleted successfully');
    } catch (postError) {
      console.error('Error deleting user posts:', postError);
      // Continue with user deletion even if post deletion fails
    }

    // Delete user from database
    await User.findByIdAndDelete(id);

    res.status(200).json({ 
      message: 'User and all associated data deleted successfully',
      deletedImages: {
        profile: !!user.profileImage,
        cover: !!user.coverImage
      }
    });
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  HandleGetUser,
  HanldeUpdateUser,
  HandleDeleteUser,
  HandleUpdatePassword,
  HandleSearchUser,
  HandleGetForProfile,
  HandleSearchALL
};