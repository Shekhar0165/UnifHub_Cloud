const express = require('express');
const router = express.Router();
const { 
    getOrganizationJourney, 
    updateOrganizationJourney,
    scheduleDailyUpdate,
    testAddJourneyMilestone,
    testSchemaFix
} = require('../../Controllers/application/OrganizationJourney');

// Get organization journey data
router.get('/:organizationId', getOrganizationJourney);

// Update organization journey for all organizations (manual trigger)
router.post('/update-all', updateOrganizationJourney);

// Test adding a journey milestone for a specific organization
router.post('/test-add-milestone/:organizationId', testAddJourneyMilestone);

// Test schema fix
router.get('/test-schema/:organizationId', testSchemaFix);

// Trigger scheduled daily update (protected, for cron/scheduler only)
router.post('/scheduled-update', async (req, res) => {
    try {
        const result = await scheduleDailyUpdate();
        
        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                message: "Failed to run scheduled update", 
                error: result.error 
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Scheduled update completed successfully",
            count: result.count
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: "Server Error", 
            error: err.message 
        });
    }
});

module.exports = router;
