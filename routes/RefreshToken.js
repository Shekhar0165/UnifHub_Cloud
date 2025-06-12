const express = require('express');
const router = express.Router();
const { handleRefreshToken } = require('../Controllers/authentication/RefreshToken');

router.post('/refresh-token', handleRefreshToken);

module.exports = router;
