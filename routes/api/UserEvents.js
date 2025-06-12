const express = require('express');
const router = express.Router();
const {
    HandlGetUserEventsList
} = require('../../Controllers/application/UserEvents');
const auth = require('../../middleware/auth');



router.get('/:id', HandlGetUserEventsList);



module.exports = router;