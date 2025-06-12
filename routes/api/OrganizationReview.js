const express = require('express');
const router = express.Router();
const {
    HandleAddOrganizationReview,
    HandleGetOrganizationReviews,
    HandleUpdateReviewStatus,
    HandleDeleteOrganizationReview
} = require('../../Controllers/application/OrganizationReview');
const auth = require('../../middleware/auth');  // Authentication middleware

// Route to add a new organization review (Protected: Requires authentication)
router.post('/add', auth, HandleAddOrganizationReview);

// Route to get all reviews for an organization (Public)
router.get('/:organizationId', HandleGetOrganizationReviews);

// Route to update review status (Protected - Admin only)
router.put('/status/:reviewId', auth, HandleUpdateReviewStatus);

// Route to delete a review (Protected - User can delete their own review)
router.delete('/:reviewId', auth, HandleDeleteOrganizationReview);

module.exports = router; 