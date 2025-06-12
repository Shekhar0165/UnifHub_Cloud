const User = require('../../models/User')
const Organization = require('../../models/Organizations')
const Team = require('../../models/Teams')
const { addUserAchievement } = require('./UserResume')
const { updateUserActivityAfterEvent } = require('./UserActivity')

const HandleAddNewTeam = async (req, res) => {
    try {
        const { teamName,OrganizationId, teamLeader, teamMembers } = req.body;

        // Check if a team with the same name exists in the organization
        const existingTeam = await Team.findOne({ teamName, OrganizationId });
        if (existingTeam) {
            console.log("Team already exists in this organization");
            return res.status(400).send("You have already created this team in the organization");
        }

        // Fetch Organization and Team Leader in parallel
        const [organization, leader] = await Promise.all([
            Organization.findById(OrganizationId),
            User.findById(teamLeader.id)
        ]);

        if (!organization) {
            return res.status(400).send("Organization not found");
        }

        if (!leader) {
            return res.status(400).send("Team Leader not found in the database");
        }

        // Populate team leader data
        teamLeader.name = leader.name;
        teamLeader.userid = leader.userid;
        teamLeader.profile_path = leader.profileImage;

        // Validate all team members in parallel
        const members = await Promise.all(
            teamMembers.map(async (member) => {
                const foundMember = await User.findById(member.id);
                if (foundMember) {
                    member.name = foundMember.name;
                    member.userid = foundMember.userid;
                    member.profile_path = foundMember.profileImage;
                }
                return foundMember; // Return member if found, else null/undefined
            })
        );

        // Find missing members
        const missingMembers = members.filter(member => !member);
        if (missingMembers.length > 0) {
            const missingNames = missingMembers.map((_, i) => teamMembers[i].name).join(", ");
            return res.status(400).send(`Members not found: ${missingNames}`);
        }

        // Check for duplicate members in the team
        const uniqueMembers = new Set(teamMembers.map(member => member.id));
        if (uniqueMembers.size !== teamMembers.length) {
            return res.status(400).send("A member cannot be added twice in the same team");
        }

        // Create new team and save it
        const newTeam = new Team({
            teamName,
            OrganizationId,
            teamLeader,
            teamMembers
        });


        await newTeam.save();

        // Add achievement for team leader
        await addUserAchievement(teamLeader.id, {
            title: `Became leader of team ${teamName}`,
            description: `Became the team leader of ${teamName} at ${organization.name}.`,
            metrics: {
                achievementType: 'team_leadership',
                teamId: newTeam._id,
                organizationId: OrganizationId,
                role: 'leader'
            }
        });
        
        // Update activity score for team leader
        await updateUserActivityAfterEvent(teamLeader.id);

        // Add achievements for all team members
        await Promise.all(
            teamMembers.map(async (member) => {
                await addUserAchievement(member.id, {
                    title: `Joined team ${teamName}`,
                    description: `Joined ${teamName} team at ${organization.name}.`,
                    metrics: {
                        achievementType: 'team_membership',
                        teamId: newTeam._id,
                        organizationId: OrganizationId,
                        role: 'member'
                    }
                });
                
                // Update activity score for team member
                await updateUserActivityAfterEvent(member.id);
            })
        );

        res.status(201).send("Team Created Successfully");
    } catch (err) {
        console.error("Error creating team:", err);
        res.status(500).send("Internal Server Error");
    }
};

const HandleGetTeam = async (req, res) => {
    try {
        const Orgid = req.params;

        // Fetch all teams for the given organization
        const findTeam = await Team.find({ OrganizationId: Orgid.id });

        if (!findTeam || findTeam.length === 0) {
            console.log("No teams found");
            return res.status(404).send("No teams found for this organization");
        }
        res.status(200).json(findTeam);
    } catch (err) {
        console.error("Error fetching teams:", err.message);
        res.status(500).send("Internal Server Error");
    }
};

const HandleUpdateTeam = async (req, res) => {
    try {
        const OrganizationId = req.params.id;
        const { teamid, teamName, teamLeader, teamMembers } = req.body;

        // Validate required fields
        if (!teamid) {
            return res.status(400).json({ message: "Team ID is required" });
        }

        // Find the team and verify ownership
        const findTeam = await Team.findOne({ OrganizationId: OrganizationId, _id: teamid });
        if (!findTeam) {
            return res.status(404).json({ message: "Team not found or unauthorized" });
        }

        // Get organization for achievement descriptions
        const organization = await Organization.findById(OrganizationId);
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Track existing members and leader for achievement updates
        const existingMemberIds = findTeam.teamMembers.map(member => member.id.toString());
        const existingLeaderId = findTeam.teamLeader.id.toString();

        // Prepare update object
        const updates = {};

        // Update team name if provided
        if (teamName) {
            const existingTeam = await Team.findOne({
                OrganizationId: OrganizationId,
                teamName,
                _id: { $ne: teamid }
            });
            if (existingTeam) {
                return res.status(400).json({ message: "Team name already exists in this organization" });
            }
            updates.teamName = teamName;
        }

        // Update team leader if provided
        if (teamLeader) {
            const leader = await User.findById(teamLeader.id);
            if (!leader) {
                return res.status(400).json({ message: "Team leader not found" });
            }
            updates.teamLeader = {
                id: leader._id,
                name: leader.name,
                userid: leader.userid,
                profile_path: leader.profileImage,
                role: 'leader' // Add role field
            };

            // Add achievement for new team leader if different from previous
            if (leader._id.toString() !== existingLeaderId) {
                await addUserAchievement(leader._id, {
                    title: `Became leader of team ${teamName || findTeam.teamName}`,
                    description: `Became the team leader of ${teamName || findTeam.teamName} at ${organization.name}.`,
                    metrics: {
                        achievementType: 'team_leadership',
                        teamId: teamid,
                        organizationId: OrganizationId,
                        role: 'leader'
                    }
                });
            }
        }

        // Update team members if provided
        if (teamMembers && Array.isArray(teamMembers)) {
            const members = await Promise.all(
                teamMembers.map(async (member) => {
                    const foundMember = await User.findById(member.id);
                    if (foundMember) {
                        return {
                            id: foundMember._id,
                            name: foundMember.name,
                            userid: foundMember.userid,
                            profile_path: foundMember.profileImage,
                            role: 'member' // Add role field
                        };
                    }
                    return null;
                })
            );

            const invalidMembers = members.includes(null);
            if (invalidMembers) {
                return res.status(400).json({ message: "One or more team members not found" });
            }

            const uniqueMembers = new Set(teamMembers.map(member => member.id));
            if (uniqueMembers.size !== teamMembers.length) {
                return res.status(400).json({ message: "Duplicate team members are not allowed" });
            }

            updates.teamMembers = members;

            // Add achievements for new team members
            const newMemberIds = teamMembers.map(member => member.id.toString());
            
            // Find members who are newly added
            const addedMembers = newMemberIds.filter(id => !existingMemberIds.includes(id));
            
            // Add achievements for new members
            await Promise.all(
                addedMembers.map(async (memberId) => {
                    await addUserAchievement(memberId, {
                        title: `Joined team ${teamName || findTeam.teamName}`,
                        description: `Joined ${teamName || findTeam.teamName} team at ${organization.name}.`,
                        metrics: {
                            achievementType: 'team_membership',
                            teamId: teamid,
                            organizationId: OrganizationId,
                            role: 'member'
                        }
                    });
                })
            );
        }

        // Update the team
        const updatedTeam = await Team.findByIdAndUpdate(
            teamid,
            { $set: updates },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: "Team updated successfully",
            team: updatedTeam
        });

    } catch (error) {
        console.error("Error updating team:", error.message);
        res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const HandleDeleteTeam = async (req, res) => {
    try {
        const { teamid,organizationId } = req.body;

        console.log({ teamid,organizationId })

        // Validate team ID
        if (!teamid) {
            return res.status(400).json({
                message: "Team ID is required"
            });
        }

        // Find and verify team ownership
        const team = await Team.findOne({
            _id: teamid,
            OrganizationId: organizationId
        });

        if (!team) {
            return res.status(404).json({
                message: "Team not found or unauthorized"
            });
        }

        // Delete the team
        const result = await Team.findByIdAndDelete(teamid);

        res.status(200).json({
            message: "Team deleted successfully",
            team: result
        });

    } catch (error) {
        console.error("Error deleting team:", error.message);
        res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};


module.exports = {HandleAddNewTeam,HandleGetTeam,HandleUpdateTeam,HandleDeleteTeam}

