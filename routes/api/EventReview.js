const express = require('express');
const router = express.Router();
const {
    HandleAddEventReview,
    HandleGetEventReviews,
    HandleUpdateEventReviewStatus,
    HandleDeleteEventReview
} = require('../../Controllers/application/EventReview');
const auth = require('../../middleware/auth');  // Authentication middleware

// Route to add a new event review (Protected: Requires authentication)
router.post('/add', auth, HandleAddEventReview);

// Route to get all reviews for an event (Public)
router.get('/:eventId', HandleGetEventReviews);

// Route to update review status (Protected - Admin only)
router.put('/status/:reviewId', auth, HandleUpdateEventReviewStatus);

// Route to delete a review (Protected - User can delete their own review)
router.delete('/:reviewId', auth, HandleDeleteEventReview);

module.exports = router; 