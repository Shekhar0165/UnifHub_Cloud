const express = require('express');
const router = express.Router();
const {HandleAddNewTeam,HandleGetTeam,HandleUpdateTeam,HandleDeleteTeam} = require('../../Controllers/application/Team');
const auth = require('../../middleware/auth');


// Protected routes - require authentication
router.post('/add',auth, HandleAddNewTeam);
router.get('/:id',auth, HandleGetTeam);
router.put('/update/:id',auth, HandleUpdateTeam);
router.delete('/delete',auth,HandleDeleteTeam)

module.exports = router;