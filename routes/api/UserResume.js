const express = require('express');
const router = express.Router();
const {
    HandleGetUserResume,
    generateResume,
    updateAllUserResumes
} = require('../../Controllers/application/UserResume');
const auth = require('../../middleware/auth');

// Generate resume for all users (admin route)
router.get('/generate-all', generateResume);

// Manual trigger for nightly update (admin route)
router.get('/update-all', async (req, res) => {
    try {
        const result = await updateAllUserResumes();
        res.status(200).json({ message: "Resume update process triggered", result });
    } catch (err) {
        res.status(500).json({ message: "Error triggering resume update", error: err.message });
    }
});

// Get a user's resume by user ID
router.get('/:id', HandleGetUserResume);

module.exports = router;