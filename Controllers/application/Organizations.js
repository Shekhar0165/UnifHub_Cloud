const Organization = require('../../models/Organizations');
const CloudinaryConfig = require('../../config/CloudinaryConfig');
const fs = require('fs').promises;

// Helper function to extract public ID from Cloudinary URL
const extractPublicId = (cloudinaryUrl) => {
    if (!cloudinaryUrl) return null;
    return cloudinaryUrl.split('/').pop().split('.')[0];
};

// Get an organization by ID
const HandleGetOrganization = async (req, res) => {
    try {
        const id = req.user.id; 

        const organization = await Organization.findById(id);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        
        res.status(200).json(organization);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const HandleGetOrganizationForUser = async (req, res) => {
    try {
        const {userid }= req.body; 

        const organization = await Organization.findOne({userid:userid});
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        
        res.status(200).json(organization);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const HandleGetAllOrganization = async (req, res) => {
    try {
        const organization = await Organization.find({});
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        
        res.status(200).json(organization);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Handle getting a pre-signed URL for S3 uploads
const HandleGetUploadUrl = async (req, res) => {
    try {
        // This will set up and return a pre-signed URL
        return orgS3Handler.getUploadUrl(req, res);
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: 'Server error', 
            error: error.message 
        });
    }
};

// Update organization information
const HandleUpdateOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Parse the orgData from FormData
        let updates = {};
        if (req.body.organizationData) {
            updates = JSON.parse(req.body.organizationData);
        } else {
            updates = { ...req.body };
        }
        
        // Get the current organization to check existing images
        const currentOrg = await Organization.findById(id);
        if (!currentOrg) {
            return res.status(404).json({ message: 'Organization not found' });
        }
          // Add file paths from Cloudinary if files were uploaded
        if (req.files) {
            if (req.files.profileImage) {
                // Delete old profile image if it exists
                if (currentOrg.profileImage) {
                    const publicId = extractPublicId(currentOrg.profileImage);
                    if (publicId) {
                        await CloudinaryConfig.deleteFile(publicId);
                    }
                }
                // Upload new image to Cloudinary
                const profileResult = await CloudinaryConfig.uploadFile(req.files.profileImage[0], 'organizations');
                if (!profileResult.success) {
                    throw new Error('Failed to upload profile image to Cloudinary');
                }
                updates.profileImage = profileResult.url;
                // Delete local file
                await fs.unlink(req.files.profileImage[0].path);
            }
            if (req.files.coverImage) {
                // Delete old cover image if it exists
                if (currentOrg.coverImage) {
                    const publicId = extractPublicId(currentOrg.coverImage);
                    if (publicId) {
                        await CloudinaryConfig.deleteFile(publicId);
                    }
                }
                // Upload new image to Cloudinary
                const coverResult = await CloudinaryConfig.uploadFile(req.files.coverImage[0], 'organizations');
                if (!coverResult.success) {
                    throw new Error('Failed to upload cover image to Cloudinary');
                }
                updates.coverImage = coverResult.url;
                // Delete local file
                await fs.unlink(req.files.coverImage[0].path);
            }
        }
        
        // Don't allow updating email without verification
        if (updates.email) {
            delete updates.email;
        }
        
        const organization = await Organization.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        
        res.status(200).json({ message: 'Organization updated successfully', organization });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete an organization
const HandleDeleteOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find organization before deletion to get image paths
        const organization = await Organization.findById(id);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
          // Delete profile image from Cloudinary if exists
        if (organization.profileImage) {
            const publicId = extractPublicId(organization.profileImage);
            if (publicId) {
                await CloudinaryConfig.deleteFile(publicId);
            }
        }
        
        // Delete cover image from Cloudinary if exists
        if (organization.coverImage) {
            const publicId = extractPublicId(organization.coverImage);
            if (publicId) {
                await CloudinaryConfig.deleteFile(publicId);
            }
        }
        
        // Delete organization from database
        await Organization.findByIdAndDelete(id);
        
        res.status(200).json({ message: 'Organization deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Add an upcoming event to organization
const HandleAddUpcomingEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, organizer, location } = req.body;
        
        if (!title || !date || !organizer || !location) {
            return res.status(400).json({ message: 'All event fields are required' });
        }
        
        const organization = await Organization.findById(id);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        
        const newEvent = {
            title,
            date: new Date(date),
            organizer,
            location
        };
        
        organization.upcomingEvents.push(newEvent);
        await organization.save();
        
        res.status(201).json({ 
            message: 'Upcoming event added successfully',
            event: newEvent
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Add a past event to organization
const HandleAddEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, position, date, participants, team } = req.body;
        
        if (!title || !date) {
            return res.status(400).json({ message: 'Title and date are required' });
        }
        
        const organization = await Organization.findById(id);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        
        const newEvent = {
            title,
            position: position || [],
            date: new Date(date),
            participants: participants || 0,
            team: team ? team.map(member => new Map(Object.entries(member))) : []
        };
        
        organization.events.push(newEvent);
        
        // Update activity data
        organization.activities.thisMonth += 1;
        organization.activities.thisYear += 1;
        
        await organization.save();
        
        res.status(201).json({ 
            message: 'Event added successfully',
            event: newEvent
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Add a team to organization
const HandleAddTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, head, members } = req.body;
        
        if (!name || !head) {
            return res.status(400).json({ message: 'Team name and head are required' });
        }
        
        const organization = await Organization.findById(id);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        
        const newTeam = {
            name,
            head,
            members: members || []
        };
        
        organization.team.push(newTeam);
        await organization.save();
        
        res.status(201).json({ 
            message: 'Team added successfully',
            team: newTeam
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update social links for organization
const HandleUpdateSocialLinks = async (req, res) => {
    try {
        const { id } = req.params;
        const { socialLinks } = req.body;
        
        if (!socialLinks) {
            return res.status(400).json({ message: 'Social links are required' });
        }
        
        const organization = await Organization.findById(id);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        
        organization.socialLinks = socialLinks;
        await organization.save();
        
        res.status(200).json({ 
            message: 'Social links updated successfully',
            socialLinks: organization.socialLinks
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update a team member
const HandleUpdateTeamMember = async (req, res) => {
    try {
        const { id } = req.params; // Organization ID
        const { teamId, memberId, updates } = req.body;
        
        if (!teamId || !memberId || !updates) {
            return res.status(400).json({ message: 'Team ID, member ID, and updates are required' });
        }
        
        const organization = await Organization.findById(id);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        
        // Find the team
        const team = organization.team.id(teamId);
        
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }
        
        // Find and update the member
        const memberIndex = team.members.findIndex(m => m._id.toString() === memberId);
        
        if (memberIndex === -1) {
            return res.status(404).json({ message: 'Team member not found' });
        }
        
        // Update member properties
        Object.keys(updates).forEach(key => {
            team.members[memberIndex][key] = updates[key];
        });
        
        await organization.save();
        
        res.status(200).json({ 
            message: 'Team member updated successfully',
            team: team
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    HandleGetOrganization,
    HandleUpdateOrganization,
    HandleDeleteOrganization,
    HandleAddUpcomingEvent,
    HandleAddEvent,
    HandleAddTeam,
    HandleUpdateSocialLinks,
    HandleGetAllOrganization,
    HandleUpdateTeamMember,
    HandleGetOrganizationForUser,
    HandleGetUploadUrl
};