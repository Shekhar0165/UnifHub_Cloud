const express = require('express');
const router = express.Router();
const {
    HandleGetOrganization,
    HandleUpdateOrganization,
    HandleDeleteOrganization,
    HandleAddUpcomingEvent,
    HandleAddEvent,
    HandleAddTeam,
    HandleUpdateSocialLinks,
    HandleGetAllOrganization,
    HandleUpdateTeamMember,
    HandleGetOrganizationForUser
} = require('../../Controllers/application/Organizations');
const auth = require('../../middleware/auth');
const MulterConfig = require('../../config/Multer');
const ImageRenderer = require('../../config/ImageRender');

// Initialize Multer
const OrgUpdate = new MulterConfig('./public/Organizations').upload();
const ImageRender = new ImageRenderer('../public/Organizations');

// Protected routes - require authentication
router.get('/', auth, HandleGetOrganization);
router.post('/one', auth, HandleGetOrganizationForUser);
router.get('/all', auth, HandleGetAllOrganization);

// Update organization info with file upload
router.put('/:id', auth, 
    OrgUpdate.fields([
        { name: 'profileImage', maxCount: 1 },
        { name: 'coverImage', maxCount: 1 }
    ]), 
    HandleUpdateOrganization
);

router.delete('/:id', auth, HandleDeleteOrganization);

// Additional organization-specific routes
router.post('/:id/upcoming-event', auth, HandleAddUpcomingEvent);
router.post('/:id/event', auth, HandleAddEvent);
router.put('/update-team/:id', auth, HandleUpdateTeamMember);
router.post('/team/:id', auth, HandleAddTeam);
router.put('/:id/social-links', auth, HandleUpdateSocialLinks);


module.exports = router;