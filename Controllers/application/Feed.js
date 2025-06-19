const User = require('../../models/User');
const Post = require('../../models/Post');
const Event = require('../../models/Event');
const Organizations = require('../../models/Organizations');
const Following = require('../../models/Following');
const mongoose = require('mongoose');

/**
 * Helper function to safely convert strings to MongoDB ObjectIds
 */
function safeObjectIds(idArray) {
    if (!idArray || !Array.isArray(idArray)) return [];
    return idArray
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
}

/**
 * Calculate engagement score based on multiple factors
 */
function calculateEngagementScore(post, userFollowingIds = []) {
    const likes = post.likes?.length || 0;
    const comments = post.comments?.length || 0;
    const shares = post.shares?.length || 0;
    const impressions = post.impressions?.length || 0;
    
    // Calculate engagement rate
    const engagementRate = impressions > 0 ? (likes + comments + shares) / impressions : 0;
    
    // Time decay factor (newer posts get higher scores)
    const postAge = Date.now() - new Date(post.createdAt).getTime();
    const hoursAge = postAge / (1000 * 60 * 60);
    const timeFactor = Math.exp(-hoursAge / 24); // Exponential decay over 24 hours
    
    // Network relevance (posts from connections get boosted)
    const isFromConnection = userFollowingIds.includes(post.userId?.toString());
    const networkBoost = isFromConnection ? 2 : 1;
    
    // Content quality indicators
    const hasMedia = post.images?.length > 0 || post.video ? 1.5 : 1;
    const hasHashtags = post.hashtags?.length > 0 ? 1.2 : 1;
    const contentLength = post.content?.length || 0;
    const lengthFactor = contentLength > 100 && contentLength < 500 ? 1.3 : 1;
    
    // Calculate final score
    const baseScore = (likes * 3) + (comments * 5) + (shares * 7) + (impressions * 0.1);
    const engagementBonus = engagementRate * 100;
    
    return (baseScore + engagementBonus) * timeFactor * networkBoost * hasMedia * hasHashtags * lengthFactor;
}

/**
 * Get user's interests based on their activity
 */
async function getUserInterests(userId) {
    try {
        // Get posts user has engaged with
        const engagedPosts = await Post.find({
            $or: [
                { 'post.likes': userId },
                { 'post.comments.userId': userId },
                { 'post.shares': userId }
            ]
        }).limit(50);
        
        // Extract hashtags and keywords
        const interests = new Set();
        engagedPosts.forEach(postDoc => {
            postDoc.post.forEach(post => {
                if (post.hashtags) {
                    post.hashtags.forEach(tag => interests.add(tag.toLowerCase()));
                }
                // Simple keyword extraction from content
                if (post.content) {
                    const words = post.content.toLowerCase().match(/\b\w{4,}\b/g) || [];
                    words.slice(0, 10).forEach(word => interests.add(word));
                }
            });
        });
        
        return Array.from(interests);
    } catch (error) {
        console.error('Error getting user interests:', error);
        return [];
    }
}

/**
 * Enhanced LinkedIn-style feed algorithm
 */
const GetEnhancedUserFeed = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 15, lastSeen = [], feedType = 'all' } = req.body;
        
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? 
            new mongoose.Types.ObjectId(userId) : null;
            
        if (!userObjectId) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        
        const skip = (page - 1) * limit;
        const validLastSeenIds = safeObjectIds(lastSeen);
        
        // Get user's network
        const userFollowing = await Following.findOne({ userid: userId });
        const followingIds = userFollowing ? 
            userFollowing.list.map(follow => follow.followingid) : [];
        
        // Get user's interests
        const userInterests = await getUserInterests(userId);
        
        // Get user's liked posts to exclude them
        const userLikedPosts = await Post.find({ 'post.likes': userObjectId }, { 'post._id': 1 });
        const likedPostIds = userLikedPosts.reduce((acc, doc) => {
            if (doc.post) {
                acc.push(...doc.post.map(p => p._id));
            }
            return acc;
        }, []);
        
        // Time threshold for content freshness
        const freshContentThreshold = new Date();
        freshContentThreshold.setHours(freshContentThreshold.getHours() - 48); // 48 hours
        
        // Base filters
        const baseFilters = {
            ...(validLastSeenIds.length > 0 ? { 'post._id': { $nin: validLastSeenIds } } : {}),
            ...(likedPostIds.length > 0 ? { 'post._id': { $nin: likedPostIds } } : {}),
            userid: { $ne: userObjectId }
        };
        
        let feedItems = [];
        
        // FEED COMPOSITION STRATEGY
        
        // 1. Recent posts from direct connections (40% of feed)
        const connectionPosts = followingIds.length > 0 ? await Post.aggregate([
            { $match: { 
                userid: { $in: followingIds },
                ...baseFilters,
                createdAt: { $gte: freshContentThreshold }
            }},
            { $unwind: '$post' },
            { $addFields: {
                engagementScore: {
                    $add: [
                        { $multiply: [{ $size: { $ifNull: ['$post.likes', []] } }, 3] },
                        { $multiply: [{ $size: { $ifNull: ['$post.comments', []] } }, 5] },
                        { $multiply: [{ $size: { $ifNull: ['$post.shares', []] } }, 7] }
                    ]
                }
            }},
            { $sort: { engagementScore: -1, 'post.createdAt': -1 } },
            { $limit: Math.ceil(limit * 0.4) },
            { $lookup: {
                from: 'users',
                localField: 'userid',
                foreignField: '_id',
                as: 'userDetails'
            }},
            { $unwind: '$userDetails' }
        ]) : [];
        
        // 2. Viral content from network (posts liked by connections) (25% of feed)
        const viralPosts = followingIds.length > 0 ? await Post.aggregate([
            { $match: {
                'post.likes': { $in: followingIds },
                userid: { $nin: [...followingIds, userObjectId] },
                ...baseFilters
            }},
            { $unwind: '$post' },
            { $match: { 'post.likes': { $in: followingIds } } },
            { $addFields: {
                networkEngagement: {
                    $size: {
                        $filter: {
                            input: '$post.likes',
                            as: 'like',
                            cond: { $in: ['$$like', followingIds] }
                        }
                    }
                },
                totalEngagement: {
                    $add: [
                        { $size: { $ifNull: ['$post.likes', []] } },
                        { $multiply: [{ $size: { $ifNull: ['$post.comments', []] } }, 2] }
                    ]
                }
            }},
            { $sort: { networkEngagement: -1, totalEngagement: -1 } },
            { $limit: Math.ceil(limit * 0.25) },
            { $lookup: {
                from: 'users',
                localField: 'userid',
                foreignField: '_id',
                as: 'userDetails'
            }},
            { $unwind: '$userDetails' }
        ]) : [];
        
        // 3. Interest-based content (20% of feed)
        const interestBasedPosts = userInterests.length > 0 ? await Post.aggregate([
            { $match: {
                ...baseFilters,
                userid: { $nin: followingIds },
                $or: [
                    { 'post.hashtags': { $in: userInterests } },
                    { 'post.content': { $regex: userInterests.slice(0, 5).join('|'), $options: 'i' } }
                ]
            }},
            { $unwind: '$post' },
            { $addFields: {
                relevanceScore: {
                    $add: [
                        { $multiply: [
                            { $size: {
                                $filter: {
                                    input: { $ifNull: ['$post.hashtags', []] },
                                    as: 'tag',
                                    cond: { $in: [{ $toLower: '$$tag' }, userInterests] }
                                }
                            }}, 
                            5
                        ]},
                        { $size: { $ifNull: ['$post.likes', []] } }
                    ]
                }
            }},
            { $sort: { relevanceScore: -1, 'post.createdAt': -1 } },
            { $limit: Math.ceil(limit * 0.2) },
            { $lookup: {
                from: 'users',
                localField: 'userid',
                foreignField: '_id',
                as: 'userDetails'
            }},
            { $unwind: '$userDetails' }
        ]) : [];
        
        // 4. Trending content (high engagement from everyone) (15% of feed)
        const trendingPosts = await Post.aggregate([
            { $match: {
                ...baseFilters,
                userid: { $nin: followingIds },
                createdAt: { $gte: freshContentThreshold }
            }},
            { $unwind: '$post' },
            { $addFields: {
                trendingScore: {
                    $divide: [
                        { $add: [
                            { $multiply: [{ $size: { $ifNull: ['$post.likes', []] } }, 2] },
                            { $multiply: [{ $size: { $ifNull: ['$post.comments', []] } }, 4] },
                            { $multiply: [{ $size: { $ifNull: ['$post.shares', []] } }, 6] }
                        ]},
                        { $add: [
                            { $divide: [
                                { $subtract: [new Date(), '$post.createdAt'] },
                                3600000 // Convert to hours
                            ]},
                            1
                        ]}
                    ]
                }
            }},
            { $match: { trendingScore: { $gte: 1 } } }, // Only include posts with decent engagement
            { $sort: { trendingScore: -1 } },
            { $limit: Math.ceil(limit * 0.15) },
            { $lookup: {
                from: 'users',
                localField: 'userid',
                foreignField: '_id',
                as: 'userDetails'
            }},
            { $unwind: '$userDetails' }
        ]);
        
        // Process and format all posts
        const processPostData = (posts, source) => {
            return posts.map(item => ({
                id: item.post._id,
                type: 'post',
                source: source,
                data: {
                    ...item.post,
                    user: {
                        name: item.userDetails.name,
                        email: item.userDetails.email,
                        profileImage: item.userDetails.profileImage,
                        _id: item.userDetails._id,
                        userid: item.userDetails.userid
                    }
                },
                engagementScore: item.engagementScore || item.networkEngagement || item.relevanceScore || item.trendingScore || 0,
                createdAt: item.post.createdAt
            }));
        };
        
        // Combine all posts
        feedItems = [
            ...processPostData(connectionPosts, 'connections'),
            ...processPostData(viralPosts, 'viral'),
            ...processPostData(interestBasedPosts, 'interests'),
            ...processPostData(trendingPosts, 'trending')
        ];
        
        // If feed is still small, add some random quality content
        if (feedItems.length < limit) {
            const additionalPosts = await Post.aggregate([
                { $match: {
                    ...baseFilters,
                    'post._id': { $nin: feedItems.map(item => item.id) }
                }},
                { $unwind: '$post' },
                { $addFields: {
                    qualityScore: {
                        $add: [
                            { $size: { $ifNull: ['$post.likes', []] } },
                            { $multiply: [{ $size: { $ifNull: ['$post.comments', []] } }, 2] }
                        ]
                    }
                }},
                { $match: { qualityScore: { $gte: 1 } } },
                { $sample: { size: limit - feedItems.length } },
                { $lookup: {
                    from: 'users',
                    localField: 'userid',
                    foreignField: '_id',
                    as: 'userDetails'
                }},
                { $unwind: '$userDetails' }
            ]);
            
            feedItems.push(...processPostData(additionalPosts, 'discovery'));
        }
        
        // Advanced sorting algorithm
        feedItems.sort((a, b) => {
            // Source priority weights
            const sourceWeights = {
                'connections': 10,
                'viral': 7,
                'interests': 5,
                'trending': 3,
                'discovery': 1
            };
            
            const weightA = sourceWeights[a.source] || 1;
            const weightB = sourceWeights[b.source] || 1;
            
            if (weightA !== weightB) {
                return weightB - weightA;
            }
            
            // If same source, sort by engagement and recency
            const engagementDiff = (b.engagementScore || 0) - (a.engagementScore || 0);
            if (Math.abs(engagementDiff) > 5) {
                return engagementDiff;
            }
            
            // Finally, sort by recency
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        // Apply pagination
        const paginatedItems = feedItems.slice(skip, skip + limit);
        
        // Record impressions
        const postIds = paginatedItems.map(item => item.id);
        if (postIds.length > 0) {
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
        
        // Clean up response
        const cleanedItems = paginatedItems.map(({ engagementScore, ...item }) => item);
        
        return res.status(200).json({
            message: 'Enhanced LinkedIn-style feed retrieved successfully',
            feed: cleanedItems,
            page,
            hasMore: feedItems.length > (skip + limit),
            feedComposition: {
                connections: paginatedItems.filter(item => item.source === 'connections').length,
                viral: paginatedItems.filter(item => item.source === 'viral').length,
                interests: paginatedItems.filter(item => item.source === 'interests').length,
                trending: paginatedItems.filter(item => item.source === 'trending').length,
                discovery: paginatedItems.filter(item => item.source === 'discovery').length
            }
        });
        
    } catch (err) {
        console.error('Feed error:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

/**
 * Enhanced impression recording with engagement tracking
 */
const RecordImpression = async (req, res) => {
    try {
        const { postId } = req.params;
        const { duration, scrollDepth, clicked } = req.body; // Additional engagement metrics
        const userId = req.user.id;
        
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ message: 'Invalid post ID format' });
        }
        
        const postDoc = await Post.findOne({ 'post._id': postId });
        if (!postDoc) {
            return res.status(404).json({ message: 'Post not found' });
        }
        
        const post = postDoc.post.id(postId);
        if (!post) {
            return res.status(404).json({ message: 'Specific post not found in document' });
        }
        
        // Enhanced impression tracking
        const existingImpressionIndex = post.impressions.findIndex(
            impression => impression.userId && impression.userId.toString() === userId
        );
        
        const impressionData = {
            userId,
            viewedAt: new Date(),
            duration: duration || 0,
            scrollDepth: scrollDepth || 0,
            clicked: clicked || false
        };
        
        if (existingImpressionIndex === -1) {
            post.impressions.push(impressionData);
        } else {
            // Update with latest data
            post.impressions[existingImpressionIndex] = {
                ...post.impressions[existingImpressionIndex],
                ...impressionData
            };
        }
        
        await postDoc.save();
        
        return res.status(200).json({ 
            message: 'Impression recorded successfully',
            impressionCount: post.impressions.length
        });
        
    } catch (err) {
        console.error('Impression recording error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get feed analytics for admin/user insights
 */
const GetFeedAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // Get user's feed performance
        const analytics = await Post.aggregate([
            { $match: { userid: userObjectId } },
            { $unwind: '$post' },
            { $addFields: {
                impressions: { $size: { $ifNull: ['$post.impressions', []] } },
                likes: { $size: { $ifNull: ['$post.likes', []] } },
                comments: { $size: { $ifNull: ['$post.comments', []] } },
                shares: { $size: { $ifNull: ['$post.shares', []] } }
            }},
            { $group: {
                _id: null,
                totalPosts: { $sum: 1 },
                totalImpressions: { $sum: '$impressions' },
                totalLikes: { $sum: '$likes' },
                totalComments: { $sum: '$comments' },
                totalShares: { $sum: '$shares' },
                avgImpressions: { $avg: '$impressions' },
                avgEngagementRate: { 
                    $avg: { 
                        $cond: [
                            { $gt: ['$impressions', 0] },
                            { $divide: [{ $add: ['$likes', '$comments', '$shares'] }, '$impressions'] },
                            0
                        ]
                    }
                }
            }}
        ]);
        
        return res.status(200).json({
            message: 'Feed analytics retrieved successfully',
            analytics: analytics[0] || {}
        });
        
    } catch (err) {
        console.error('Analytics error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    GetEnhancedUserFeed,
    RecordImpression,
    GetFeedAnalytics
};