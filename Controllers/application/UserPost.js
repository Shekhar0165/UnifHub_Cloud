const User = require('../../models/User')
const Post = require('../../models/Post')
const UserResume = require('../../models/UserResume');
const mongoose = require('mongoose');
const CloudinaryConfig = require('../../config/CloudinaryConfig');
const fs = require('fs').promises;

// Helper function to extract public ID from Cloudinary URL
const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  try {
    // Extract public ID from Cloudinary URL
    // Example URL: https://res.cloudinary.com/your-cloud/image/upload/v1234567890/posts/filename.jpg
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

// Get all posts for a user
const GetUserPosts = async (req, res) => {
    try {
        const userId = req.params.id;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's posts with populated user data
        const posts = await Post.findOne({ userid: userId })
            .populate('userid', 'name email profileImage userid');

        if (!posts) {
            return res.status(200).json({ message: 'No posts found for this user', posts: [] });
        }

        return res.status(200).json({ posts });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get pending posts from user resume
const HandlePandingPost = async (req, res) => {
    try {
        const id = req.user.id;
        const user = await User.findById(id)
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userResume = await UserResume.findOne({ UserId: id })
        if (!userResume) {
            return res.status(404).json({ message: 'User resume not found' });
        }
        const pendingPosts = userResume.Journey.filter(post => !post.isPosted);
        if (pendingPosts.length === 0) {
            return res.status(404).json({ message: 'No pending posts found' });
        }

        res.status(200).json({ pendingPosts });
    }
    catch (err) {
        res.status(500).json({ message: err.message })
    }
}

// Add a new post
const HandleAddAchievementPost = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description, content, isAchievementPosted, isAchivementPosted, achievementid } = req.body;
        
        if (!title || !description || !content) {
            return res.status(400).json({ message: 'All required fields must be provided' });
        }
          let image_path = "";
        if (req.file) {
            // Upload to Cloudinary
            const result = await CloudinaryConfig.uploadFile(req.file, 'posts');
            if (!result.success) {
                throw new Error('Failed to upload image to Cloudinary');
            }
            image_path = result.url;
            // Delete local file after upload
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting local file:', unlinkError);
            }
        }
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // If it's an achievement post, validate achievementid
        // Converting isAchievementPosted to a proper boolean to avoid comparison issues
        // Check for both the correctly spelled and misspelled versions of the field
        const isAchievement = isAchievementPosted === true || 
                             isAchievementPosted === "true" || 
                             isAchivementPosted === true || 
                             isAchivementPosted === "true";
        
        if (isAchievement) {
            
            // Need to import mongoose at the top of the file
            if (!achievementid || !mongoose.Types.ObjectId.isValid(achievementid)) {
                return res.status(400).json({ message: 'Valid Achievement ID is required for achievement posts' });
            }
            
            const userResume = await UserResume.findOne({
                UserId: userId,
                'Journey._id': new mongoose.Types.ObjectId(achievementid)
            });
            
            // Find the specific achievement in the Journey array
            const achievement = userResume?.Journey?.find(
                item => item._id.toString() === achievementid
            );
            
            if (!userResume || !achievement) {
                return res.status(404).json({ message: 'Achievement not found in user resume' });
            }
        }
        
        
        // Create new post object
        const newPost = {
            title,
            description,
            content,
            image_path,
            likes: [],
            comments: [],
            isAchievementPosted: isAchievement // Ensure consistent boolean value
        };

        
        if (isAchievement) {
            newPost.achievementid = achievementid;
            newPost.isAchivementPosted = isAchievement; // Ensure consistent boolean value
        }
        
        // Find or create the user's Post document
        let userPost = await Post.findOne({ userid: userId });
        
        if (!userPost) {
            userPost = new Post({
                userid: userId,
                post: [newPost]
            });
        } else {
            userPost.post.unshift(newPost);
        }
        
        // Save the post
        await userPost.save(); 
        
        // Update achievement status only if it's an achievement post
        if (isAchievement) {
            await UserResume.findOneAndUpdate(
                { UserId: userId, 'Journey._id': new mongoose.Types.ObjectId(achievementid) },
                { $set: { 'Journey.$[elem].isPosted': true } },
                {
                    arrayFilters: [{ 'elem._id':new mongoose.Types.ObjectId(achievementid) }],
                    new: true
                }
            );
        }
        
        
        return res.status(201).json({ message: 'Post added successfully', post: newPost });
        
    } catch (err) {
        console.error('Error adding post:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

const HandleCheckUserLikeOrNot = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id; // Assuming auth middleware sets user

        // Find the post document that contains the post with postId
        const postDoc = await Post.findOne({ 'post._id': postId });
        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Find the specific post
        const post = postDoc.post.id(postId);

        // Check if user already liked the post
        const alreadyLiked = post.likes.includes(userId);

        return res.status(200).json({
            message: alreadyLiked ? 'User has liked the post' : 'User has not liked the post',
            liked: alreadyLiked
        });
    }
    catch (err) {   
        return res.status(500).json({ message: 'Internal server error' });
    }
}

// Update an existing post
const HandleUpdatePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { title, description, content } = req.body;
        const userId = req.user.id; // Assuming auth middleware sets user

        // Find the post document
        const postDoc = await Post.findOne({
            'post._id': postId,
            'userid': userId // Ensure user owns the post
        });

        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found or you do not have permission to update it' });
        }

        // Find the specific post
        const post = postDoc.post.id(postId);

        // Check if a new image was uploaded
        if (req.file) {
            // Delete old image from Cloudinary if it exists
            if (post.image_path) {
                const publicId = extractPublicIdFromUrl(post.image_path);
                if (publicId) {
                    try {
                        await CloudinaryConfig.deleteFile(publicId);
                        console.log('Old post image deleted successfully:', publicId);
                    } catch (deleteError) {
                        console.error('Error deleting old post image:', deleteError);
                        // Continue with upload even if deletion fails
                    }
                }
            }

            // Upload new image to Cloudinary
            const result = await CloudinaryConfig.uploadFile(req.file, 'posts');
            if (!result.success) {
                throw new Error('Failed to upload image to Cloudinary');
            }
            // Set the new image path
            post.image_path = result.url;
            
            // Delete local file after upload
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting local file:', unlinkError);
            }
        }

        // Update fields if provided
        if (title) post.title = title;
        if (description) post.description = description;
        if (content) post.content = content;

        await postDoc.save();

        return res.status(200).json({ message: 'Post updated successfully', post });
    } catch (err) {
        console.error('Error updating post:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Delete a post
const HandleDeletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id; // Assuming auth middleware sets user

        // Find the post document
        const postDoc = await Post.findOne({
            'post._id': postId,
            'userid': userId // Ensure user owns the post
        });

        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found or you do not have permission to delete it' });
        }

        // Find the specific post to delete its image first
        const post = postDoc.post.id(postId);
        
        // Delete the image from Cloudinary if it exists
        if (post.image_path) {
            const publicId = extractPublicIdFromUrl(post.image_path);
            if (publicId) {
                try {
                    await CloudinaryConfig.deleteFile(publicId);
                    console.log('Post image deleted successfully from Cloudinary:', publicId);
                } catch (deleteError) {
                    console.error('Error deleting post image from Cloudinary:', deleteError);
                    // Continue with post deletion even if image deletion fails
                }
            }
        }

        // Remove the post from the array
        postDoc.post.pull({ _id: postId });
        await postDoc.save();

        return res.status(200).json({ 
            message: 'Post deleted successfully',
            deletedImage: !!post.image_path
        });
    } catch (err) {
        console.error('Error deleting post:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Like or unlike a post
const HandleLikePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id; // Assuming auth middleware sets user

        // Find the post document that contains the post with postId
        const postDoc = await Post.findOne({ 'post._id': postId });
        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Find the specific post
        const post = postDoc.post.id(postId);

        // Check if user already liked the post
        const alreadyLiked = post.likes.includes(userId);

        if (alreadyLiked) {
            // Remove like (unlike)
            post.likes = post.likes.filter(id => id.toString() !== userId);
        } else {
            // Add like
            post.likes.push(userId);
        }

        await postDoc.save();

        // Get user info for each like
        const likedBy = await User.find(
            { _id: { $in: post.likes } },
            'name profileImage'
        );

        return res.status(200).json({
            message: alreadyLiked ? 'Post unliked successfully' : 'Post liked successfully',
            likeCount: post.likes.length,
            liked: !alreadyLiked,
            likedBy
        });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Comment on a post
const HandleCommentPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { comment } = req.body;
        const userId = req.user.id; // Assuming auth middleware sets user

        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ message: 'Comment cannot be empty' });
        }

        const postDoc = await Post.findOne({ 'post._id': postId });
        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const post = postDoc.post.id(postId);

        const newComment = {
            userId,
            comment,
            createdAt: new Date()
        };

        post.comments.push(newComment);
        await postDoc.save();

        // Get user info for the comment
        const commentUser = await User.findById(userId, 'name profileImage');

        // Format the response with user info
        const commentWithUser = {
            ...newComment,
            user: commentUser
        };

        return res.status(200).json({
            message: 'Comment added successfully',
            comment: commentWithUser,
            commentCount: post.comments.length
        });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get comments for a post with user info
const GetPostComments = async (req, res) => {
    try {
        const { postId } = req.params;

        const postDoc = await Post.findOne({ 'post._id': postId });
        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const post = postDoc.post.id(postId);

        // Get all user info for comments in one query
        const userIds = post.comments.map(comment => comment.userId);
        const users = await User.find(
            { _id: { $in: userIds } },
            'name profileImage'
        );

        // Create a map for quick lookup
        const userMap = {};
        users.forEach(user => {
            userMap[user._id.toString()] = user;
        });

        // Add user info to each comment
        const commentsWithUserInfo = post.comments.map(comment => {
            return {
                ...comment.toObject(),
                user: userMap[comment.userId.toString()]
            };
        });

        return res.status(200).json({
            comments: commentsWithUserInfo,
            commentCount: post.comments.length
        });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Get users who liked a post
const GetPostLikes = async (req, res) => {
    try {
        const { postId } = req.params;

        const postDoc = await Post.findOne({ 'post._id': postId });
        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const post = postDoc.post.id(postId);

        // Get user info for each like
        const likedBy = await User.find(
            { _id: { $in: post.likes } },
            'name profileImage'
        );

        return res.status(200).json({
            likes: likedBy,
            likeCount: post.likes.length
        });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const HandlePostCount = async (req, res) => {
    try {
      const userId = req.params.id;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Get user's posts with populated user data
      const posts = await Post.findOne({ userid: userId })
  
      if (!posts) {
        return res.status(200).json({ message: 'No posts found for this user', posts: [] });
      }
      
      const PostCount = posts.post.length
  
      return res.status(200).json({ PostCount });
    } catch (err) {
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

const HandleGetUserPostById = async (req, res) => {
    try {
        const userId = req.body.userid; // Assuming auth middleware sets user
        const postId = req.params.postId;

        const NewUser = await User.find({
            userid: userId
        });

        const newId = NewUser[0]._id.toString()

        // Find post document for the user
        const postDoc = await Post.findOne({ 
            userid: newId,
            'post._id': postId 
        }).populate('userid', 'name email profileImage userid');

        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Get the specific post from the posts array
        const post = postDoc.post.id(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        return res.status(200).json({ 
            post: {
                ...post.toObject(),
                user: postDoc.userid
            }
        });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
}

module.exports = {
    HandlePandingPost,
    HandleAddAchievementPost,
    HandleUpdatePost,
    HandleDeletePost,
    HandleLikePost,
    HandleCommentPost,
    GetUserPosts,
    GetPostComments,
    GetPostLikes,
    HandleCheckUserLikeOrNot,
    HandlePostCount,
    HandleGetUserPostById
}