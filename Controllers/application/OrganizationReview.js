const OrganizationReview = require("../../models/OrganizationReview");
const Organization = require("../../models/Organizations");
const User = require("../../models/User");
const mongoose = require("mongoose");
const { addReviewScore } = require("./OrganizationActivity");

// Add a new organization review
const HandleAddOrganizationReview = async (req, res) => {
    try {
        const { organizationId, rating, comment } = req.body;
        const userId = req.user.id; // Get user ID from authenticated request

        // Validate input
        if (!organizationId || !rating || !comment) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        // Check if the organization exists
        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Check if user has already reviewed this organization
        const existingReview = await OrganizationReview.findOne({ 
            organizationId, 
            userId 
        });

        if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this organization" });
        }

        // Create new review
        const newReview = new OrganizationReview({
            organizationId,
            userId,
            rating,
            comment,
            status: "pending" // Default status
        });

        await newReview.save();

        res.status(201).json({ 
            message: "Review submitted successfully and waiting for approval", 
            review: newReview 
        });
    } catch (error) {
        res.status(500).json({ message: "Error submitting review", error: error.message });
    }
};

// Get all reviews for an organization
const HandleGetOrganizationReviews = async (req, res) => {
    try {
        const { organizationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
            return res.status(400).json({ message: "Invalid organization ID" });
        }

        const reviews = await OrganizationReview.find({ 
            organizationId, 
            status: "approved" 
        }).populate("userId", "name profileImage");

        // Calculate average rating
        let totalRating = 0;
        if (reviews.length > 0) {
            totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        }
        const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

        res.status(200).json({ 
            reviews, 
            averageRating,
            totalReviews: reviews.length 
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching reviews", error: error.message });
    }
};

// Update review status (for admins)
const HandleUpdateReviewStatus = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ message: "Invalid review ID" });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'" });
        }

        const updatedReview = await OrganizationReview.findByIdAndUpdate(
            reviewId,
            { status },
            { new: true }
        );

        if (!updatedReview) {
            return res.status(404).json({ message: "Review not found" });
        }

        // If the review is approved, update the organization's average rating
        if (status === "approved") {
            const organization = await Organization.findById(updatedReview.organizationId);
            if (organization) {
                // Calculate new average rating
                const approvedReviews = await OrganizationReview.find({
                    organizationId: updatedReview.organizationId,
                    status: "approved"
                });
                
                const totalRating = approvedReviews.reduce((sum, review) => sum + review.rating, 0);
                const newAverage = totalRating / approvedReviews.length;
                
                // Update organization with new rating
                organization.rating = {
                    average: newAverage,
                    count: approvedReviews.length
                };
                
                await organization.save();

                // Update organization activity score
                try {
                    await addReviewScore(updatedReview.organizationId, updatedReview);
                    console.log(`Organization activity score updated for new review ${updatedReview._id}`);
                } catch (err) {
                    console.error("Error updating organization activity score:", err);
                }
            }
        }

        res.status(200).json({ 
            message: `Review ${status} successfully`, 
            review: updatedReview 
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating review status", error: error.message });
    }
};

// Delete a review (user can delete their own review)
const HandleDeleteOrganizationReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ message: "Invalid review ID" });
        }

        const review = await OrganizationReview.findById(reviewId);
        
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        // Check if the user is the owner of the review
        if (review.userId.toString() !== userId) {
            return res.status(403).json({ message: "You are not authorized to delete this review" });
        }

        await OrganizationReview.findByIdAndDelete(reviewId);

        res.status(200).json({ message: "Review deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting review", error: error.message });
    }
};

module.exports = {
    HandleAddOrganizationReview,
    HandleGetOrganizationReviews,
    HandleUpdateReviewStatus,
    HandleDeleteOrganizationReview
}; 