const User = require('../../models/User');
const Post = require('../../models/Post');
const Event = require('../../models/Event');
const Organizations = require('../../models/Organizations');
const Following = require('../../models/Following');
const mongoose = require('mongoose');

/**
 * Helper function to safely convert strings to MongoDB ObjectIds
 * Filters out invalid IDs and properly creates ObjectId instances
 */
function safeObjectIds(idArray) {
    if (!idArray || !Array.isArray(idArray)) return [];
    return idArray
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
}

/**
 * Get enhanced user feed with Instagram-like engagement features
 * Feed combines:
 * - Posts from followed users
 * - Posts liked by followed users (network amplification)
 * - Popular posts with high impression counts
 * - Events and organizations
 * - Prevents showing same content multiple times within 1-2 day window
 */


const GetEnhancedUserFeed = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, lastSeen = [] } = req.body;
        
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? 
            new mongoose.Types.ObjectId(userId) : null;
            
        if (!userObjectId) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        
        // Find user follows
        const userFollowing = await Following.findOne({ userid: userId });
        
        // Get array of users this user follows
        const followingIds = userFollowing ? 
            userFollowing.list.map(follow => follow.followingid) : [];

        // Find posts liked by the user to exclude them
        const userLikedPosts = await Post.find({ 'post.likes': userObjectId }, { 'post._id': 1 });
        const likedPostIds = userLikedPosts.reduce((acc, doc) => {
            if (doc.post) {
                acc.push(...doc.post.map(p => p._id));
            }
            return acc;
        }, []);
            
        // Feed composition parameters
        const followedPostsCount = 30;
        const networkAmplifiedPostsCount = 20;
        const popularPostsCount = 10;
        const randomPostsCount = 20; // Number of random posts to fetch if feed is empty
        
        // Calculate skip value based on page number
        const skip = (page - 1) * limit;
        
        // Convert lastSeen array to valid MongoDB ObjectIds
        const validLastSeenIds = safeObjectIds(lastSeen);
        
        // Calculate time threshold for re-showing posts (1-2 days ago)
        const minRecycleTime = new Date();
        minRecycleTime.setDate(minRecycleTime.getDate() - 2);
        
        // Prepare impression filters
        const impressionFilter = {
            $or: [
                { 'post.impressions.userId': { $ne: userObjectId } },
                { 
                    'post.impressions': { 
                        $elemMatch: { 
                            userId: userObjectId,
                            viewedAt: { $lt: minRecycleTime }
                        } 
                    }
                }
            ]
        };
        
        // Additional filter for already seen posts in this session
        const notSeenFilter = validLastSeenIds.length > 0 ? 
            { 'post._id': { $nin: validLastSeenIds } } : {};

        // Additional filter to exclude liked posts
        const notLikedFilter = likedPostIds.length > 0 ?
            { 'post._id': { $nin: likedPostIds } } : {};
            
        // STEP 1: Get posts from followed users
        const followedPosts = followingIds.length > 0 ? 
            await Post.find({ 
                userid: { $in: followingIds },
                ...impressionFilter,
                ...notSeenFilter,
                ...notLikedFilter
            })
            .sort({ createdAt: -1 })
            .limit(followedPostsCount)
            .populate('userid', 'name email profileImage userid')
            .lean() : [];
            
        // STEP 2: Get posts liked by people you follow (network amplification)
        const networkAmplifiedPosts = followingIds.length > 0 ? 
            await Post.aggregate([
                { $match: { 
                    'post.likes': { $in: followingIds },
                    userid: { $nin: [...followingIds, userObjectId] },
                    $or: [
                        { 'post.impressions.userId': { $ne: userObjectId } },
                        { 'post.impressions.viewedAt': { $lt: minRecycleTime } }
                    ],
                    ...(validLastSeenIds.length > 0 ? { 'post._id': { $nin: validLastSeenIds } } : {}),
                    ...(likedPostIds.length > 0 ? { 'post._id': { $nin: likedPostIds } } : {})
                }},
                // Unwind the post array to work with individual posts
                { $unwind: '$post' },
                // Now filter to only keep posts that have been liked by followed users
                { $match: { 'post.likes': { $in: followingIds } } },
                // Look up the user info
                { $lookup: {
                    from: 'users',
                    localField: 'userid',
                    foreignField: '_id',
                    as: 'userDetails'
                }},
                { $unwind: '$userDetails' },
                // Add a field to track which followed users liked this post
                { $addFields: {
                    followedUsersWhoLiked: {
                        $filter: {
                            input: '$post.likes',
                            as: 'likeId',
                            cond: { $in: ['$$likeId', followingIds] }
                        }
                    },
                    likeCount: { $size: '$post.likes' }
                }},
                // Sort by the number of followed users who liked and the total like count
                { $sort: { 
                    followedUsersWhoLikedCount: -1,
                    likeCount: -1,
                    'post.createdAt': -1 
                }},
                { $limit: networkAmplifiedPostsCount },
                // Project the final structure
                { $project: {
                    _id: 1,
                    post: 1,
                    followedUsersWhoLiked: 1,
                    likeCount: 1,
                    'user.name': '$userDetails.name',
                    'user.email': '$userDetails.email',
                    'user.profileImage': '$userDetails.profileImage',
                    'user._id': '$userDetails._id',
                    'user.userid': '$userDetails.userid',
                }}
            ]) : [];
            
        // STEP 3: Get popular posts
        const popularPosts = await Post.aggregate([
            { $match: {
                ...impressionFilter,
                ...(validLastSeenIds.length > 0 ? { 'post._id': { $nin: validLastSeenIds } } : {}),
                ...(likedPostIds.length > 0 ? { 'post._id': { $nin: likedPostIds } } : {}),
                userid: { $ne: userObjectId },
                userid: { $nin: followingIds }
            }},
            // Unwind the post array
            { $unwind: '$post' },
            // Add impression count field
            { $addFields: {
                impressionCount: { $size: { $ifNull: ['$post.impressions', []] } },
                likeCount: { $size: { $ifNull: ['$post.likes', []] } }
            }},
            // Create a popularity score (combination of impressions and likes)
            { $addFields: {
                popularityScore: { $add: ['$impressionCount', { $multiply: ['$likeCount', 2] }] }
            }},
            // Sort by the popularity score
            { $sort: { popularityScore: -1 } },
            { $limit: popularPostsCount },
            // Look up user info
            { $lookup: {
                from: 'users',
                localField: 'userid',
                foreignField: '_id',
                as: 'userDetails'
            }},
            { $unwind: '$userDetails' },
            // Project the final structure
            { $project: {
                _id: 1,
                post: 1,
                impressionCount: 1,
                likeCount: 1,
                popularityScore: 1,
                'user.name': '$userDetails.name',
                'user.email': '$userDetails.email',
                'user.profileImage': '$userDetails.profileImage',
                'user._id': '$userDetails._id',
                'user.userid': '$userDetails.userid'
            }}
        ]);

        // Format all items for the feed
        let feedItems = [];
        
        // Add followed posts to feed
        if (followedPosts.length > 0) {
            followedPosts.forEach(postDoc => {
                if (postDoc.post && Array.isArray(postDoc.post)) {
                    postDoc.post.forEach(post => {
                        if (post && post._id) {
                            feedItems.push({
                                id: post._id,
                                type: 'post',
                                source: 'followed',
                                data: {
                                    ...post,
                                    user: postDoc.userid
                                },
                                createdAt: post.createdAt || postDoc.createdAt
                            });
                        }
                    });
                }
            });
        }
        
        // Add network amplified posts to feed
        if (networkAmplifiedPosts.length > 0) {
            networkAmplifiedPosts.forEach(item => {
                if (item.post && item.post._id) {
                    // Create list of users who liked this post that the current user follows
                    const likedByFollowedUsers = item.followedUsersWhoLiked || [];
                    
                    feedItems.push({
                        id: item.post._id,
                        type: 'post',
                        source: 'network',
                        data: {
                            ...item.post,
                            user: item.user
                        },
                        likedBy: likedByFollowedUsers,
                        likeCount: item.likeCount,
                        createdAt: item.post.createdAt
                    });
                }
            });
        }
        
        // Add popular posts to feed
        if (popularPosts.length > 0) {
            popularPosts.forEach(item => {
                if (item.post && item.post._id) {
                    feedItems.push({
                        id: item.post._id,
                        type: 'post',
                        source: 'popular',
                        impressionCount: item.impressionCount,
                        likeCount: item.likeCount,
                        popularityScore: item.popularityScore,
                        data: {
                            ...item.post,
                            user: item.user
                        },
                        createdAt: item.post.createdAt
                    });
                }
            });
        }

        // If feed is empty, get random posts
        if (feedItems.length === 0) {
            const randomPosts = await Post.aggregate([
                { $match: {
                    userid: { $ne: userObjectId },
                    ...(likedPostIds.length > 0 ? { 'post._id': { $nin: likedPostIds } } : {})
                }},
                { $sample: { size: randomPostsCount } },
                { $unwind: '$post' },
                { $lookup: {
                    from: 'users',
                    localField: 'userid',
                    foreignField: '_id',
                    as: 'userDetails'
                }},
                { $unwind: '$userDetails' },
                { $project: {
                    _id: 1,
                    post: 1,
                    'user.name': '$userDetails.name',
                    'user.email': '$userDetails.email',
                    'user.profileImage': '$userDetails.profileImage',
                    'user._id': '$userDetails._id',
                    'user.userid': '$userDetails.userid'
                }}
            ]);

            randomPosts.forEach(item => {
                if (item.post && item.post._id) {
                    feedItems.push({
                        id: item.post._id,
                        type: 'post',
                        source: 'random',
                        data: {
                            ...item.post,
                            user: item.user
                        },
                        createdAt: item.post.createdAt
                    });
                }
            });
        }

        // Sort feed items by recency first (for equal weights)
        feedItems.sort((a, b) => {
            // Parse dates if they're strings
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return dateB - dateA;
        });
        
        // Apply weighting to ensure preferred content appears first
        const weightedItems = feedItems.map(item => {
            let weight = 1;
            
            // Assign weights based on source
            if (item.type === 'post') {
                switch(item.source) {
                    case 'followed':
                        weight = 10;
                        break;
                    case 'network':
                        weight = 5;
                        break;
                    case 'popular':
                        weight = 2;
                        break;
                    case 'random':
                        weight = 1; // Lowest priority for random posts
                        break;
                }
            } else if (item.type === 'event') {
                weight = 3;
            } else if (item.type === 'organization') {
                weight = 1;
            }
            
            return { ...item, weight };
        });

        // Sort by weight and recency
        weightedItems.sort((a, b) => {
            if (a.weight !== b.weight) {
                return b.weight - a.weight; // Higher weight first
            }
            
            // If weights are equal, sort by recency
            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
            return dateB - dateA;
        });
        
        // Apply pagination
        const paginatedItems = weightedItems.slice(skip, skip + limit);
        
        // Track impressions for posts in the feed
        const postIds = paginatedItems
            .filter(item => item.type === 'post' && item.id)
            .map(item => item.id);
            
        if (postIds.length > 0) {
            // Update impressions for posts
            await Promise.all(
                postIds.map(async (postId) => {
                    try {
                        await Post.updateOne(
                            { 'post._id': postId },
                            { 
                                $addToSet: { 
                                    'post.$.impressions': {
                                        userId: userObjectId,
                                        viewedAt: new Date()
                                    }
                                }
                            }
                        );
                    } catch (updateErr) {
                        console.error(`Error updating impression for post ${postId}:`, updateErr);
                    }
                })
            );
        }
        
        // Remove internal weight property before sending response
        const cleanedItems = paginatedItems.map(({ weight, ...item }) => item);
        console.log({
            message: 'Enhanced feed retrieved successfully',
            feed: cleanedItems,
            page,
            hasMore: weightedItems.length > (skip + limit)
        })
        return res.status(200).json({
            message: 'Enhanced feed retrieved successfully',
            feed: cleanedItems,
            page,
            hasMore: weightedItems.length > (skip + limit)
        });
        
    } catch (err) {
        console.error('Error getting enhanced feed:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

/**
 * Mark post as viewed/record impression
 */
const RecordImpression = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        // Validate postId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ message: 'Invalid post ID format' });
        }
        
        // Find the post
        const postDoc = await Post.findOne({ 'post._id': postId });
        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found' });
        }
        
        // Find the specific post
        const post = postDoc.post.id(postId);
        if (!post) {
            return res.status(404).json({ message: 'Specific post not found in document' });
        }
        
        // Check if impression already exists
        const existingImpressionIndex = post.impressions.findIndex(
            impression => impression.userId && 
            impression.userId.toString() === userId
        );
        
        if (existingImpressionIndex === -1) {
            // Add new impression
            post.impressions.push({
                userId,
                viewedAt: new Date()
            });
        } else {
            // Update existing impression with new timestamp
            post.impressions[existingImpressionIndex].viewedAt = new Date();
        }
        
        await postDoc.save();
        
        return res.status(200).json({ 
            message: 'Impression recorded successfully',
            impressionCount: post.impressions.length
        });
        
    } catch (err) {
        console.error('Error recording impression:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get more feed items for infinite scrolling
 */
const GetMoreFeedItems = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page, limit = 10, viewedPosts = [] } = req.body;
        console.log("Loading more items:", page, limit, "viewed count:", viewedPosts.length);
        
        if (!page || page < 1) {
            return res.status(400).json({ message: 'Valid page number is required' });
        }
        
        // Create a new request object with the properties we need
        const newReq = {
            ...req,
            body: { page, limit, lastSeen: viewedPosts }
        };
        
        return GetEnhancedUserFeed(newReq, res);
        
    } catch (err) {
        console.error('Error getting more feed items:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    GetEnhancedUserFeed,
    RecordImpression,
    GetMoreFeedItems
};