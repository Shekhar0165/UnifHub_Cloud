const User = require('../../models/User');
const Following = require('../../models/Following');
const mongoose = require('mongoose');

/**
 * Generate follower suggestions for a user based on multiple factors:
 * 1. Second-degree connections (friends of friends)
 * 2. People with similar skills/interests
 * 3. People from the same university or location
 * 4. Popular users in the network
 * 5. Recent active users
 */
const HandleShowFollowingListToUser = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get current user details
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Find users that the current user is already following
        const userFollowing = await Following.findOne({ userid: userId });
        let followingList = [];
        
        if (userFollowing && userFollowing.list && userFollowing.list.length > 0) {
            followingList = userFollowing.list.map(follow => follow.userid);
        }
        
        // Add the user's own ID to the list to exclude from suggestions
        followingList.push(currentUser.userid);
        
        // Algorithm to get different types of suggestions
        const [
            secondDegreeConnections,
            similarInterestUsers,
            sameBackgroundUsers,
            popularUsers,
            recentActiveUsers
        ] = await Promise.all([
            getSecondDegreeConnections(userId, followingList),
            getSimilarInterestUsers(currentUser, followingList),
            getSameBackgroundUsers(currentUser, followingList),
            getPopularUsers(followingList),
            getRecentActiveUsers(followingList)
        ]);
        
        // Combine all suggestion types with weights
        const allSuggestions = [
            ...secondDegreeConnections.map(user => ({ ...user, score: user.score * 2 })), // Higher priority
            ...similarInterestUsers.map(user => ({ ...user, score: user.score * 1.5 })),
            ...sameBackgroundUsers,
            ...popularUsers,
            ...recentActiveUsers
        ];
        
        // Remove duplicates by userid
        const uniqueSuggestions = [];
        const seenUserIds = new Set();
        
        allSuggestions.forEach(suggestion => {
            if (!seenUserIds.has(suggestion.userid)) {
                seenUserIds.add(suggestion.userid);
                uniqueSuggestions.push(suggestion);
            }
        });
        
        // Sort by score (highest first) and take the top 5
        uniqueSuggestions.sort((a, b) => b.score - a.score);
        const topSuggestions = uniqueSuggestions.slice(0, 5);
        
        return res.status(200).json({
            success: true,
            message: "Follower suggestions retrieved successfully",
            suggestions: topSuggestions
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to get follower suggestions",
            error: error.message
        });
    }
};

/**
 * Get more suggestions when user requests them (pagination)
 */
const HandleGetMoreSuggestion = async (req, res) => {
    try {
        const userId = req.user.id;
        const { skip = 0 } = req.query;
        const skipCount = parseInt(skip);
        
        // Get current user details
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Find users that the current user is already following
        const userFollowing = await Following.findOne({ userid: userId });
        let followingList = [];
        
        if (userFollowing && userFollowing.list && userFollowing.list.length > 0) {
            followingList = userFollowing.list.map(follow => follow.userid);
        }
        
        // Add the user's own ID to the list to exclude from suggestions
        followingList.push(currentUser.userid);
        
        // Algorithm to get different types of suggestions
        const [
            secondDegreeConnections,
            similarInterestUsers,
            sameBackgroundUsers,
            popularUsers,
            recentActiveUsers
        ] = await Promise.all([
            getSecondDegreeConnections(userId, followingList),
            getSimilarInterestUsers(currentUser, followingList),
            getSameBackgroundUsers(currentUser, followingList),
            getPopularUsers(followingList),
            getRecentActiveUsers(followingList)
        ]);
        
        // Combine all suggestion types with weights
        const allSuggestions = [
            ...secondDegreeConnections.map(user => ({ ...user, score: user.score * 2 })),
            ...similarInterestUsers.map(user => ({ ...user, score: user.score * 1.5 })),
            ...sameBackgroundUsers,
            ...popularUsers,
            ...recentActiveUsers
        ];
        
        // Remove duplicates by userid
        const uniqueSuggestions = [];
        const seenUserIds = new Set();
        
        allSuggestions.forEach(suggestion => {
            if (!seenUserIds.has(suggestion.userid)) {
                seenUserIds.add(suggestion.userid);
                uniqueSuggestions.push(suggestion);
            }
        });
        
        // Sort by score (highest first)
        uniqueSuggestions.sort((a, b) => b.score - a.score);
        
        // Apply pagination
        const paginatedSuggestions = uniqueSuggestions.slice(skipCount, skipCount + 5);
        const hasMore = uniqueSuggestions.length > (skipCount + 5);
        
        return res.status(200).json({
            success: true,
            message: "More follower suggestions retrieved successfully",
            suggestions: paginatedSuggestions,
            hasMore: hasMore
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to get more follower suggestions",
            error: error.message
        });
    }
};

/**
 * Helper functions to get different types of suggestions
 */

// Get users who are followed by people the current user follows (second-degree connections)
async function getSecondDegreeConnections(userId, followingList) {
    try {
        // Find all users the current user is following
        const followingUsers = await Following.find({ userid: { $in: followingList } });
        
        // Collect IDs of users followed by the people the current user follows
        const secondDegreeIds = new Set();
        const connectionStrength = new Map(); // Track how many mutual connections
        
        followingUsers.forEach(followingUser => {
            if (followingUser.list && followingUser.list.length > 0) {
                followingUser.list.forEach(followedUser => {
                    // Skip if this is a user we're already following
                    if (!followingList.includes(followedUser.userid)) {
                        secondDegreeIds.add(followedUser.userid);
                        
                        // Count how many mutual connections we have with this user
                        const currentCount = connectionStrength.get(followedUser.userid) || 0;
                        connectionStrength.set(followedUser.userid, currentCount + 1);
                    }
                });
            }
        });
        
        // Get detailed info for these second-degree connections
        const secondDegreeUsers = await User.find({
            userid: { $in: Array.from(secondDegreeIds) }
        });
        
        // Format the result and apply scores based on connection strength
        return secondDegreeUsers.map(user => ({
            userId: user._id,
            userid: user.userid,
            name: user.name,
            bio: user.bio || "",
            image_path: user.profileImage || "",
            score: (connectionStrength.get(user.userid) || 1) * 3, // Base score based on mutual connections
            suggestionReason: "Connected to people you follow"
        }));
    } catch (error) {
        return [];
    }
}

// Get users with similar interests/skills
async function getSimilarInterestUsers(currentUser, followingList) {
    try {
        // If user has no skills, return empty list
        if (!currentUser.skills || currentUser.skills.length === 0) {
            return [];
        }
        
        // Find users with similar skills (at least one match)
        const similarUsers = await User.find({
            userid: { $nin: followingList },
            skills: { $in: currentUser.skills }
        });
        
        // Calculate skill match score
        return similarUsers.map(user => {
            // Count matching skills
            const matchingSkills = user.skills ? 
                user.skills.filter(skill => currentUser.skills.includes(skill)) : 
                [];
            
            return {
                userId: user._id,
                userid: user.userid,
                name: user.name,
                bio: user.bio || "",
                image_path: user.profileImage || "",
                score: matchingSkills.length * 2, // 2 points per matching skill
                suggestionReason: "Has similar interests to you"
            };
        });
    } catch (error) {
        return [];
    }
}

// Get users from same university or location
async function getSameBackgroundUsers(currentUser, followingList) {
    try {
        const query = { userid: { $nin: followingList } };
        
        // Add education or location filters if available
        if (currentUser.university) {
            query.university = currentUser.university;
        }
        
        if (currentUser.location) {
            query.location = currentUser.location;
        }
        
        // If we have no filtering criteria, return empty
        if (Object.keys(query).length <= 1) {
            return [];
        }
        
        const backgroundUsers = await User.find(query);
        
        return backgroundUsers.map(user => {
            let score = 0;
            let reasons = [];
            
            // Add points for university match
            if (currentUser.university && user.university === currentUser.university) {
                score += 5;
                reasons.push("university");
            }
            
            // Add points for location match
            if (currentUser.location && user.location === currentUser.location) {
                score += 3;
                reasons.push("location");
            }
            
            let reasonText = "From your ";
            if (reasons.includes("university") && reasons.includes("location")) {
                reasonText += "university and location";
            } else if (reasons.includes("university")) {
                reasonText += "university";
            } else if (reasons.includes("location")) {
                reasonText += "location";
            }
            
            return {
                userId: user._id,
                userid: user.userid,
                name: user.name,
                bio: user.bio || "",
                image_path: user.profileImage || "",
                score: score,
                suggestionReason: reasonText
            };
        });
    } catch (error) {
        return [];
    }
}

// Get popular users (users with many followers - using a proxy by checking their appearance in Following lists)
async function getPopularUsers(followingList) {
    try {
        // This is a simplified approach - ideally you'd have a dedicated follower count in the user schema
        // For now, we'll count occurrences in following lists as a proxy for popularity
        
        // Get all following documents
        const allFollowings = await Following.find({});
        
        // Count how many times each user appears in others' following lists
        const userPopularity = new Map();
        
        allFollowings.forEach(following => {
            if (following.list && following.list.length > 0) {
                following.list.forEach(followedUser => {
                    const currentCount = userPopularity.get(followedUser.userid) || 0;
                    userPopularity.set(followedUser.userid, currentCount + 1);
                });
            }
        });
        
        // Convert to array and sort by popularity (descending)
        const popularUserIds = Array.from(userPopularity.entries())
            .filter(([userid]) => !followingList.includes(userid)) // Remove already followed users
            .sort((a, b) => b[1] - a[1]) // Sort by count (most popular first)
            .slice(0, 10) // Take top 10 most popular
            .map(([userid]) => userid);
        
        // Get user details for these popular users
        const popularUsers = await User.find({
            userid: { $in: popularUserIds }
        });
        
        // Format the result
        return popularUsers.map(user => ({
            userId: user._id,
            userid: user.userid,
            name: user.name,
            bio: user.bio || "",
            image_path: user.profileImage || "",
            score: userPopularity.get(user.userid) || 0,
            suggestionReason: "Popular on the platform"
        }));
    } catch (error) {
        return [];
    }
}

// Get recently active users (based on updatedAt timestamp)
async function getRecentActiveUsers(followingList) {
    try {
        // Get users who were recently active (sorted by last update time)
        const recentUsers = await User.find({
            userid: { $nin: followingList }
        })
        .sort({ updatedAt: -1 }) // Most recent first
        .limit(10);
        
        // Format the result
        return recentUsers.map((user, index) => ({
            userId: user._id,
            userid: user.userid,
            name: user.name,
            bio: user.bio || "",
            image_path: user.profileImage || "",
            score: 10 - index, // Higher score for more recently active users
            suggestionReason: "Recently active"
        }));
    } catch (error) {
        return [];
    }
}

module.exports = { HandleShowFollowingListToUser, HandleGetMoreSuggestion };