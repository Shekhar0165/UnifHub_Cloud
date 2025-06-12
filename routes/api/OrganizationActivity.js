const express = require('express');
const router = express.Router();
const {
    HandleGetOrganizationActivity,
    HandleRecalculateOrganizationActivity,
    HandleGetTopOrganizations
} = require('../../Controllers/application/OrganizationActivity');
const auth = require('../../middleware/auth');  // Authentication middleware

// Get organization activity scores
router.get('/:organizationId', HandleGetOrganizationActivity);

// Route to recalculate organization activity (admin functionality)
router.post('/recalculate/:organizationId', auth, HandleRecalculateOrganizationActivity);

// Get top organizations by activity score
router.get('/leaderboard/top', HandleGetTopOrganizations);

module.exports = router; 