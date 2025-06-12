const express = require('express');
const router = express.Router();
const {
    HandleAddParticipants,
    HandleGetAllParticipants,
    HandleUpdateParticipants,
    HandleDeleteParticipants,
    HandleDeleteTeam,
    HandleDeclareResult,
    HandleEditResult,
    HandleCheckTeam,
    HandleGetParticipantsByEvent,
    HandleGetParticipantsByUserId,
    HandleUpdateParticipantsTeam,
    HandleSearchParticipants,
    HandleVerifyParticipants,
    HandleGetVerifyedParticipantsByUserId,
    
} = require('../../Controllers/application/Participants');
const auth = require('../../middleware/auth');

// Route to register a user for an event (Protected)
router.post('/register', auth, HandleAddParticipants);
router.post('/check-team', HandleCheckTeam);
router.get('/all', HandleGetAllParticipants);
router.get('/for-events/:eventid', HandleGetParticipantsByEvent);
router.post('/user', auth, HandleGetParticipantsByUserId);
router.post('/user/verify', auth, HandleGetVerifyedParticipantsByUserId);
router.post('/declareResult', auth, HandleDeclareResult);
router.post('/update-team', auth, HandleUpdateParticipantsTeam); // Added auth middleware
router.post('/available/search', auth, HandleSearchParticipants);
router.post('/verify/accept', auth, HandleVerifyParticipants);
// router.post('/verify/reject', auth, HandleRejectParticipants);

module.exports = router;
