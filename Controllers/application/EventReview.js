const EventReview = require("../../models/EventReview");
const Event = require("../../models/Event");
const EventMember = require("../../models/EventsMember");
const User = require("../../models/User");
const mongoose = require("mongoose");

// Add a new event review
const HandleAddEventReview = async (req, res) => {
    try {
        const { eventId, rating, comment } = req.body;
        const userId = req.user.id; // Get user ID from authenticated request

        // Validate input
        if (!eventId || !rating || !comment) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        // Check if the event exists and is completed
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Only allow reviews for completed events
        if (event.status !== "completed") {
            return res.status(400).json({ 
                message: "Reviews can only be submitted for completed events" 
            });
        }

        // Check if user was a participant in the event
        const eventMembers = await EventMember.findOne({ eventId: eventId.toString() });
        if (!eventMembers) {
            return res.status(404).json({ message: "Event members not found" });
        }

        let isParticipant = false;
        // Check if user is event head or vice head
        if (eventMembers.eventHead === userId || eventMembers.eventViceHead === userId) {
            isParticipant = true;
        } else {
            // Check if user is a member of any team
            for (const team of eventMembers.eventTeams) {
                if (team.members.includes(userId)) {
                    isParticipant = true;
                    break;
                }
            }
        }

        if (!isParticipant) {
            return res.status(403).json({ 
                message: "Only participants of the event can submit reviews" 
            });
        }

        // Check if user has already reviewed this event
        const existingReview = await EventReview.findOne({ 
            eventId, 
            userId 
        });

        if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this event" });
        }

        // Create new review
        const newReview = new EventReview({
            eventId,
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

// Get all reviews for an event
const HandleGetEventReviews = async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: "Invalid event ID" });
        }

        const reviews = await EventReview.find({ 
            eventId, 
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
const HandleUpdateEventReviewStatus = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ message: "Invalid review ID" });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'" });
        }

        const updatedReview = await EventReview.findByIdAndUpdate(
            reviewId,
            { status },
            { new: true }
        );

        if (!updatedReview) {
            return res.status(404).json({ message: "Review not found" });
        }

        // If the review is approved, update the event's average rating
        if (status === "approved") {
            const event = await Event.findById(updatedReview.eventId);
            if (event) {
                // Calculate new average rating
                const approvedReviews = await EventReview.find({
                    eventId: updatedReview.eventId,
                    status: "approved"
                });
                
                const totalRating = approvedReviews.reduce((sum, review) => sum + review.rating, 0);
                const newAverage = totalRating / approvedReviews.length;
                
                // Update event with new rating
                event.rating = {
                    average: newAverage,
                    count: approvedReviews.length
                };
                
                await event.save();
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
const HandleDeleteEventReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ message: "Invalid review ID" });
        }

        const review = await EventReview.findById(reviewId);
        
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        // Check if the user is the owner of the review
        if (review.userId.toString() !== userId) {
            return res.status(403).json({ message: "You are not authorized to delete this review" });
        }

        await EventReview.findByIdAndDelete(reviewId);

        res.status(200).json({ message: "Review deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting review", error: error.message });
    }
};

module.exports = {
    HandleAddEventReview,
    HandleGetEventReviews,
    HandleUpdateEventReviewStatus,
    HandleDeleteEventReview
}; 