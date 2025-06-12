const express = require('express')
const router = express.Router()
const {HandleAddTeamMemberInEvents,HandleGetAllEvents,HandleUpdateEventMember} = require('../../Controllers/application/EventsMember')
const auth = require('../../middleware/auth');

router.post('/add/:id',auth,HandleAddTeamMemberInEvents);
router.post('/get/:id',HandleGetAllEvents);
router.put('/update/:id',auth,HandleUpdateEventMember);

module.exports = router