const express = require('express');
const router = express.Router();
const {
    SendVerificationCode,
    IsEmailVerify,
    forgetPassword,
    ChangePasswordFromToken
    
} = require('../Controllers/authentication/ResetPassword');
const auth = require('../middleware/auth')


// Refresh token route
router.post('/password', forgetPassword);
router.post('/verify-otp', IsEmailVerify);
router.post('/send-otp', SendVerificationCode);
router.post('/change-pwd',auth, ChangePasswordFromToken);

module.exports = router;
