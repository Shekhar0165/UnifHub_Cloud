const mongoose = require("mongoose");
const User = require("../../models/User");
const Organization = require("../../models/Organizations");
const Follower = require("../../models/Follower");
const Following = require("../../models/Following");

// Helper function to get entity (user or organization) by ID
const getEntityById = async (id) => {
    // Try to find as user first
    let entity = await User.findById(id);
    let entityType = "user";
    
    // If not found as user, try as organization
    if (!entity) {
        entity = await Organization.findById(id);
        entityType = "organization";
    }
    
    return { entity, entityType };
};

// Helper function to add a user/organization to the following list
const HandleAddFollowing = async (followerid, userid) => {
    try {
        // ✅ Validate IDs
        if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(followerid)) {
            return { error: "Invalid User ID or Follower ID" };
        }

        // ✅ Check if both entities exist and detect their types
        const { entity: userExists, entityType: detectedEntityType } = await getEntityById(userid);
        const { entity: followerExists, entityType: detectedFollowerType } = await getEntityById(followerid);

        if (!userExists || !followerExists) {
            return { error: "Entity not registered on the platform" };
        }

        // ✅ Check if followerid already has a Following document
        let followerFollowingDoc = await Following.findOne({ userid: followerid });

        // ✅ Check if already following
        if (followerFollowingDoc && followerFollowingDoc.list.some(f => f.followingid.toString() === userid.toString())) {
            return { error: `Already following ${userExists.name}` };
        }

        // ✅ Create new following entry using detected type
        const FollowingEntry = {
            followingid: userid,
            image_path: userExists.profileImage || "",
            bio: userExists.bio || "",
            name: userExists.name,
            userid: userExists.userid,
            entityType: detectedEntityType // Using detected type of entity being followed
        };

        if (!followerFollowingDoc) {
            // Create new Following document with detected follower type
            followerFollowingDoc = new Following({
                userid: followerid,
                entityType: detectedFollowerType, // Using detected type of follower
                list: [FollowingEntry]
            });
        } else {
            // ✅ If document exists, push new following to the list
            followerFollowingDoc.list.push(FollowingEntry);
        }

        // ✅ Save to database
        await followerFollowingDoc.save();

        return {
            message: "Following added successfully",
            data: followerFollowingDoc
        };

    } catch (err) {
        console.error(err.message);
        return { error: "Server error" };
    }
};

// Helper function to remove a user from the following list
const HandleRemoveFollowing = async (followerid, userid) => {
    try {
        // ✅ Validate IDs
        if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(followerid)) {
            return { error: "Invalid User ID or Follower ID" };
        }

        // ✅ Find the following document
        const followingDoc = await Following.findOne({ userid: followerid });

        if (!followingDoc) {
            return { error: "Following relationship not found" };
        }

        // ✅ Check if the user is being followed
        const followingIndex = followingDoc.list.findIndex(item =>
            item.followingid.toString() === userid.toString()
        );

        if (followingIndex === -1) {
            return { error: "Not following this user" };
        }

        // ✅ Remove the user from following list
        followingDoc.list.splice(followingIndex, 1);

        // ✅ Save changes or remove document if list is empty
        if (followingDoc.list.length === 0) {
            await Following.findByIdAndDelete(followingDoc._id);
        } else {
            await followingDoc.save();
        }

        return { message: "Successfully unfollowed" };

    } catch (err) {
        console.error(err.message);
        return { error: "Server error" };
    }
};

// Helper function to remove a follower
const HandleRemoveFollower = async (userid, followerid) => {
    try {
        // ✅ Validate IDs
        if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(followerid)) {
            return { error: "Invalid User ID or Follower ID" };
        }

        // ✅ Find the follower document
        const followerDoc = await Follower.findOne({ userid });

        if (!followerDoc) {
            return { error: "Follower relationship not found" };
        }

        // ✅ Check if the user is a follower
        const followerIndex = followerDoc.list.findIndex(item =>
            item.followerid.toString() === followerid.toString()
        );

        if (followerIndex === -1) {
            return { error: "User is not a follower" };
        }

        // ✅ Remove the follower from list
        followerDoc.list.splice(followerIndex, 1);

        // ✅ Save changes or remove document if list is empty
        if (followerDoc.list.length === 0) {
            await Follower.findByIdAndDelete(followerDoc._id);
        } else {
            await followerDoc.save();
        }

        return { message: "Follower removed successfully" };

    } catch (err) {
        console.error(err.message);
        return { error: "Server error" };
    }
};

// Main function to add a follower and update following
const HandleAddFollower = async (req, res) => {
    try {
        const { userid } = req.body;
        const followerid = req.user.id;

        // ✅ Validate IDs
        if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(followerid)) {
            return res.status(400).json({ error: "Invalid User ID or Follower ID" });
        }

        if(userid === followerid){
            return res.status(400).json({ error: "Same User Can Not Follow themselves" });
        }

        // ✅ Check if both entities exist and get their types
        const { entity: userExists, entityType: detectedEntityType } = await getEntityById(userid);
        const { entity: followerExists, entityType: detectedFollowerType } = await getEntityById(followerid);

        if (!userExists || !followerExists) {
            return res.status(404).json({ error: "Entity not registered on the platform" });
        }

        // ✅ Check if userid already has a Follower document
        let userFollowerDoc = await Follower.findOne({ userid });

        // ✅ Check if already following
        if (userFollowerDoc && userFollowerDoc.list.some(f => f.followerid.toString() === followerid.toString())) {
            return res.status(400).json({ error: `Follower already follows ${userExists.name}` });
        }

        // ✅ Create new follower entry with the automatically detected follower type
        const FollowerEntry = {
            followerid: followerid,
            image_path: followerExists.profileImage || "",
            bio: followerExists.bio || "",
            name: followerExists.name,
            userid: followerExists.userid,
            entityType: detectedFollowerType // Using detected type for follower
        };

        if (!userFollowerDoc) {
            // Create new Follower document with the automatically detected entity type
            userFollowerDoc = new Follower({
                userid: userid,
                entityType: detectedEntityType, // Using detected type for entity being followed
                list: [FollowerEntry]
            });
        } else {
            userFollowerDoc.list.push(FollowerEntry);
        }

        // ✅ Add to following list - pass the detected types
        const followingResult = await HandleAddFollowing(followerid, userid);

        if (followingResult.error && followingResult.error !== `Already following ${userExists.name}`) {
            return res.status(500).json({ error: followingResult.error });
        }

        await userFollowerDoc.save();

        return res.status(200).json({ 
            message: "Follower added successfully", 
            success: true, 
            data: userFollowerDoc 
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "Server error" });
    }
};

// Main function to handle unfollowing a user
const HandleUnfollow = async (req, res) => {
    try {
        const { userid } = req.body;
        const followerid = req.user.id;

        // ✅ Remove from following list
        const followingResult = await HandleRemoveFollowing(followerid, userid);
        if (followingResult.error) {
            return res.status(400).json({ error: followingResult.error });
        }

        // ✅ Remove from followers list
        const followerResult = await HandleRemoveFollower(userid, followerid);
        if (followerResult.error) {
            return res.status(400).json({ error: followerResult.error });
        }

        return res.status(200).json({ message: "Successfully unfollowed", success: true });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "Server error" });
    }
};

const HandleCheckIsFollowed = async (req, res) => {
    try {
        const userid = req.user.id;
        const followerid = req.params.userid; 
        console.log(userid, followerid);

        // ✅ Validate IDs
        if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(followerid)) {
            return res.status(400).json({ error: "Invalid User ID or Follower ID" });
        }

        // ✅ Check if both entities exist
        const { entity: userExists } = await getEntityById(userid);
        const { entity: followerExists } = await getEntityById(followerid);

        if (!userExists || !followerExists) {
            return res.status(404).json({ error: "User not registered on the platform" });
        }

        // Check if userid is in followerid's follower list
        const checkFollow = await Follower.findOne({
            userid: followerid,
            "list.followerid": userid
        });

        if (checkFollow) {
            return res.status(200).json({ isFollower: true });
        } else {
            return res.status(200).json({ isFollower: false });
        }
    }
    catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "Server error" });
    }
};

const HandleGetFollowerAndFollowingList = async (req, res) => {
    try {
        const id = req.params.userid;
        console.log(id)
        if (!id) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const { entity, entityType } = await getEntityById(id);
        if (!entity) {
            return res.status(404).json({ message: "Entity not found" });
        }

        const followers = await Follower.findOne({ userid: id });
        const following = await Following.findOne({ userid: id });

        const followerList = followers?.list || [];
        const followingList = following?.list || [];

        console.log(followerList, followingList);
        return res.status(200).json({ 
            entityType,
            followerList, 
            followingList 
        });

    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: "Server error" });
    }
};

module.exports = {
    HandleAddFollower,
    HandleUnfollow,
    HandleCheckIsFollowed,
    HandleGetFollowerAndFollowingList
};