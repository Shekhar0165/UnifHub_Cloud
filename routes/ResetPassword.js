const express = require('express');
const router = express.Router();
const {
    SendVerificationCode,
    IsEmailVerify,
    forgetPassword
} = require('../Controllers/authentication/ResetPassword');


// Refresh token route
router.post('/password', forgetPassword);
router.post('/verify-otp', IsEmailVerify);
router.post('/send-otp', SendVerificationCode);

module.exports = router;
