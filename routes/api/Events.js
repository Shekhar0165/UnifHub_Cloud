const express = require('express');
const router = express.Router();
const {
    HandleAddEvent,
    HandleUpdateEvents,
    HandleDeleteEvents,
    HandleGetAllEvents,
    HandleRegisterForEvent,
    HandleGetEventByOrganization,
    HandleGetOneEvent,
    HandleUPComingEventsForUser
} = require('../../Controllers/application/Events');
const auth = require('../../middleware/auth');
const MulterConfig = require('../../config/Multer');
const ImageRenderer = require('../../config/ImageRender');
// Initialize Multer
const EventUpdate = new MulterConfig('./public/Events').upload();
const ImageRender = new ImageRenderer('../public/Events');

// Route to add a new event (Protected: Requires authentication)
router.post('/add', auth, EventUpdate.single('image'), HandleAddEvent);

// Route to update an event by ID (Protected)
router.put('/update/:eventId', auth, EventUpdate.single('image'), HandleUpdateEvents);

// Route to delete an event by ID (Protected)
router.delete('/delete/:eventId', auth, HandleDeleteEvents);

router.get('/upcoming/:userId', HandleUPComingEventsForUser);


router.post('/getevents', auth, HandleGetEventByOrganization);
router.post('/one', auth, HandleGetOneEvent);

// Route to get all events (Public)
router.get('/all', HandleGetAllEvents);

// Route to upload/update event image (Protected)
router.post('/upload/:eventId', auth, EventUpdate.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const CloudinaryConfig = require('../../config/CloudinaryConfig');
        const fs = require('fs').promises;
        
        // Upload to Cloudinary
        const result = await CloudinaryConfig.uploadFile(req.file, 'events');
        if (!result.success) {
            throw new Error('Failed to upload image to Cloudinary');
        }

        // Delete local file after upload
        await fs.unlink(req.file.path);
        
        res.status(200).json({ 
            message: 'Image uploaded successfully', 
            fileUrl: result.url,
            public_id: result.public_id
        });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading image', error: error.message });
    }
});


module.exports = router;
