const bcrypt = require('bcrypt');
const User = require('../../models/User');
const Organization = require('../../models/Organizations');
const UserResume = require('../../models/UserResume');
const Otp = require('../../config/GenerateOtp');
const jwt = require('jsonwebtoken');
const { tr } = require('date-fns/locale');
const { generateUserResume } = require('../../Controllers/application/UserResume');
const journey = require('../../models/OrganizationJourney');

const otpInstances = {}; // Store OTP instances and verification status

// Validation helpers
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long.' };
    }

    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    }

    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    }

    if (!/\d/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number.' };
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character.' };
    }

    return { valid: true };
};

const validateUserID = (userid) => {
    // UserID must be alphanumeric and between 3-20 characters
    const useridRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return useridRegex.test(userid);
};

const validateName = (name) => {
    // Name must be 2-50 characters, allowing letters, spaces, hyphens and apostrophes
    if (!name || name.trim().length < 2 || name.trim().length > 50) {
        return { valid: false, message: 'Name must be between 2 and 50 characters.' };
    }

    // Allow letters, spaces, hyphens, and apostrophes in names
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(name)) {
        return { valid: false, message: 'Name can only contain letters, spaces, hyphens, and apostrophes.' };
    }

    return { valid: true };
};

const SendVerificationCode = async (req, res) => {
    const { email } = req.body;

    // Email validation
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({ message: "Please provide a valid email address" });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

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

const IsEmailVerify = async (req, res) => {
    const { code, email } = req.body;
    console.log("Received Verification Request:", { code, email });

    // Validate inputs
    if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
    }

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({ message: "Please provide a valid email address" });
    }

    if (!otpInstances[email]) {
        console.log("OTP instance not found for email:", email);
        return res.status(400).json({
            message: "OTP expired or not generated. Please request a new one."
        });
    }

    try {
        const isValid = await otpInstances[email].otpInstance.VerifyOtp(code);
        console.log("OTP Validation Result:", isValid);

        if (isValid) {
            otpInstances[email].isVerified = true;
            return res.status(200).json({ message: "Email verified successfully." });
        } else {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }
    } catch (err) {
        console.error("Error in VerifyOtp:", err);
        return res.status(400).json({ message: err.message });
    }
};

// Add a function to create initial user resume
const createInitialUserResume = async (userId, user) => {
    try {
        // Check if user already has a resume
        let userResume = await UserResume.findOne({ UserId: userId });

        if (!userResume) {
            // Create a new resume with registration achievement
            userResume = new UserResume({
                UserId: userId,
                Journey: [{
                    title: "Joined UnifHub",
                    Date: new Date(),
                    description: `${user.name} joined UnifHub and started their journey.`,
                    metrics: { achievementType: 'registration' }
                }]
            });

            await userResume.save();
            console.log(`Created initial resume for user ${userId}`);
        }

        return userResume;
    } catch (err) {
        console.error('Error creating initial user resume:', err);
        return null;
    }
};

const registerUser = async (req, res) => {
    try {
        let { name, userid, email, password } = req.body;

        // Validate all fields
        if (!name || !userid || !email || !password) {
            return res.status(400).json({
                message: 'All fields are required: name, userid, email, and password.'
            });
        }
        userid = userid.toLowerCase();

        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({ message: 'Please provide a valid email address.' });
        }

        // Validate name
        const nameValidation = validateName(name);
        if (!nameValidation.valid) {
            return res.status(400).json({ message: nameValidation.message });
        }


        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ message: passwordValidation.message });
        }

        // Check if email is verified
        if (!otpInstances[email] || !otpInstances[email].isVerified) {
            return res.status(400).json({ message: 'Email verification is required. Please verify your email first.' });
        }

        // Check if userid already exists
        const existingUserid = await User.findOne({ userid });
        if (existingUserid) {
            return res.status(400).json({ message: 'User ID is already taken. Please choose another.' });
        }

        // Double-check email isn't already used (in case concurrent registrations)
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ message: 'Email is already registered. Please use another email or login.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            name,
            userid,
            email,
            password: hashedPassword,
            university: "",
            bio: "",
            location: "",
            phone: ""
        });

        await newUser.save();

        // Create initial user resume with registration achievement
        await createInitialUserResume(newUser._id, newUser);

        // Generate JWT tokens
        const accessToken = jwt.sign(
            { id: newUser._id },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15min' }
        );


        const refreshToken = jwt.sign(
            { id: newUser._id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        // Store refresh token in the database
        newUser.refreshToken = refreshToken;
        await newUser.save();

        const UserId = newUser.userid;
        console.log(UserId);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? "None" : "Lax",
            path: '/',
            maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
        });

        // Set refresh token in HTTP-only, Secure cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? "None" : "Lax",
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Cleanup OTP instance after successful registration
        delete otpInstances[email];

        // Send tokens in response body for localStorage
        console.log("User registered successfully");
        return res.status(201).json({
            message: 'User registered successfully',
            user: {
                userid: newUser.userid,
                userType: "individual"
            },
            accessToken,
            refreshToken,

        });

    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'An error occurred during registration. Please try again later.' });
    }
};


const registerOrganization = async (req, res) => {
    try {
        let { name, userid, email, password} = req.body;

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({
                message: 'Required fields missing: name and email are required.'
            });
        }
        userid = userid.toLowerCase();

        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({ message: 'Please provide a valid email address.' });
        }

        // Validate name
        const nameValidation = validateName(name);
        if (!nameValidation.valid) {
            return res.status(400).json({ message: nameValidation.message });
        }

        // Check if email is verified
        if (!otpInstances[email] || !otpInstances[email].isVerified) {
            return res.status(400).json({ message: 'Email verification is required. Please verify your email first.' });
        }

        // Double-check email isn't already used (in case concurrent registrations)
        const existingEmail = await Organization.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ message: 'Email is already registered. Please use another email.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new organization
        const newOrganization = new Organization({
            name,
            userid,
            password: hashedPassword,
            university: "",
            bio: "",
            email,
            // socialLinks: socialLinks ? new Map(Object.entries(socialLinks)) : new Map(),
            activities: {
                thisMonth: 0,
                lastMonth: 0,
                thisYear: 0,
                contributionData: Array(52).fill().map(() => Array(7).fill(0)),
                streakDays: 0,
                longestStreak: 0,
                contributions: Array(12).fill(0)
            }
        });

        const org = await newOrganization.save();

        console.log("Organization registered successfully:", org._id);

        const journeyData = {
            OrganizationId: org._id,
            Journey: [{
                title: "Joined UnifHub",
                Date: new Date(),
                description: `${org.name} joined UnifHub and started their journey.`,
                achievementType: 'registration' 
            }]
        };

        await journey.create(journeyData)
            .then(() => console.log("Organization journey created successfully"))
            .catch(err => console.error("Error creating organization journey:", err));

        // Generate JWT tokens
        const accessToken = jwt.sign(
            { id: newOrganization._id, isOrganization: true },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '1d' }
        );

        const refreshToken = jwt.sign(
            { id: newOrganization._id, isOrganization: true },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        const userId = newOrganization.userid;

        // Update organization with refresh token
        newOrganization.refreshToken = refreshToken;
        await newOrganization.save();

        // Set access token in HTTP-only, Secure cookie
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? "None" : "Lax",
            path: '/',
            maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
        });

        // Set refresh token in HTTP-only, Secure cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? "None" : "Lax",
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Cleanup OTP instance after successful registration
        delete otpInstances[email];

        // Send tokens in response body for localStorage
        return res.status(201).json({
            message: 'Organization registered successfully',
            user: {
                userid: newOrganization.userid,
                userType: "Organization"
            },
            accessToken,
            refreshToken
        });

    } catch (err) {
        console.error('Error registering organization:', err);
        res.status(500).json({ message: 'An error occurred during registration. Please try again later.' });
    }
};


module.exports = {
    registerUser,
    IsEmailVerify,
    SendVerificationCode,
    registerOrganization
};