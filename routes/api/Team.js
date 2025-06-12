const express = require('express');
const router = express.Router();
const {HandleAddNewTeam,HandleGetTeam,HandleUpdateTeam,HandleDeleteTeam} = require('../../Controllers/application/Team');
const auth = require('../../middleware/auth');


// Protected routes - require authentication
router.post('/add', HandleAddNewTeam);
router.get('/:id', HandleGetTeam);
router.put('/update/:id', HandleUpdateTeam);
router.delete('/delete',auth,HandleDeleteTeam)

module.exports = router;