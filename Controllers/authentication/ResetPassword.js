const bcrypt = require('bcrypt');
const User = require('../../models/User'); 
const Organizations = require('../../models/Organizations'); 
const Otp = require('../../config/GenerateOtp');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose')

const otpInstances = {}; // Store OTP instances and verification status

// Helper functions
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validatePassword = (password) => {
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters long.' };
    if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    if (!/[a-z]/.test(password)) return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    if (!/\d/.test(password)) return { valid: false, message: 'Password must contain at least one number.' };
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return { valid: false, message: 'Password must contain at least one special character.' };
    return { valid: true };
};

// Step 1: Send Verification Code
const SendVerificationCode = async (req, res) => {
    const { email } = req.body;
    
    if (!email || !validateEmail(email)) {
        return res.status(400).json({ message: "Please provide a valid email address" });
    }
    
    try {
        const existingUser = await User.findOne({ email });
        const existingOrganization = await Organizations.findOne({ email });
        
        if (!existingUser && !existingOrganization) {
            return res.status(404).json({ message: "Account not found with this email." });
        }
        
        const account = existingUser || existingOrganization;
        console.log(account)

        otpInstances[email] = {
            otpInstance: new Otp(email, process.env.ADMIN_EMAIL),
            isVerified: false
        };

        await otpInstances[email].otpInstance.GenerateOtp();
        res.status(200).json({ message: "OTP sent to your email address" });
    } catch (error) {
        console.error("Error sending verification code:", error);
        res.status(500).json({ message: "Failed to send verification code. Please try again." });
    }
};

// Step 2: Verify OTP
const IsEmailVerify = async (req, res) => {
    const { code, email } = req.body;

    if (!email || !validateEmail(email) || !code) {
        return res.status(400).json({ message: "Invalid email or OTP" });
    }

    if (!otpInstances[email]) {
        return res.status(400).json({ message: "OTP expired or not generated. Please request a new one." });
    }

    try {
        const isValid = await otpInstances[email].otpInstance.VerifyOtp(code);

        if (isValid) {
            otpInstances[email].isVerified = true;
            return res.status(200).json({ message: "Email verified successfully." });
        } else {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }
    } catch (err) {
        console.error("Error in OTP verification:", err);
        return res.status(400).json({ message: "OTP verification failed. Try again." });
    }
};

// Step 3: Reset Password
const forgetPassword = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !validateEmail(email)) {
            return res.status(400).json({ message: "Invalid email address." });
        }

        if (!password) {
            return res.status(400).json({ message: "Password is required." });
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ message: passwordValidation.message });
        }

        // Check if email verification was completed
        if (!otpInstances[email] || !otpInstances[email].isVerified) {
            return res.status(400).json({ message: "Email verification required. Please verify your email first." });
        }

        // Find the user
        const existingUser = await User.findOne({ email });
        const existingOrganization = await Organizations.findOne({ email });
        
        if (!existingUser && !existingOrganization) {
            return res.status(404).json({ message: "Account not found with this email." });
        }
        
        const account = existingUser || existingOrganization;
        console.log(account)
        let session;

        try {
            // Start mongoose session for transaction safety
            const session = await mongoose.startSession();
            session.startTransaction();

            // Hash new password
            const hashedPassword = await bcrypt.hash(password, 10);
            account.password = hashedPassword;
            await account.save({ session });

            // Generate JWT tokens
            const accessToken = jwt.sign({ id: account._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            const refreshToken = jwt.sign({ id: account._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

            // Store refresh token in DB
            account.refreshToken = refreshToken;
            await account.save({ session });

            // Commit transaction
            await session.commitTransaction();
            session.endSession();

            // Clear OTP instance
            delete otpInstances[email];

            return res.status(200).json({
                message: "Password reset successfully",
                accessToken,
                refreshToken
            });
            
        } catch (error) {
            // If session was started, abort transaction
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            throw error;
        }

    } catch (err) {
        console.error("Error resetting password:", err);
        res.status(500).json({ message: "An error occurred. Please try again later." });
    }
};

module.exports = {
    SendVerificationCode,
    IsEmailVerify,
    forgetPassword
};
