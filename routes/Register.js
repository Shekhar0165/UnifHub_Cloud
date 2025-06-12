const express = require('express');
const router = express.Router();
const { registerUser, IsEmailVerify, SendVerificationCode, registerOrganization } = require('../Controllers/authentication/Register');
const { LoginUser } = require('../Controllers/authentication/Login');
const { LogoutUser } = require('../Controllers/authentication/Logout');

// Authentication routes
router.post('/student/register', registerUser);
router.post('/org/register', registerOrganization);
router.post('/verify-otp', IsEmailVerify);
router.post('/send-otp', SendVerificationCode);
router.post('/login', LoginUser);
router.get('/logout', LogoutUser);

module.exports = router;
