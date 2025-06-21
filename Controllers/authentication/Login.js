const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Organization = require('../../models/Organizations');
const { generateUserResume } = require('../application/UserResume');
require('dotenv').config();
const { client } = require('../../config/GoogleAuthConfig');
const { default: axios } = require('axios');




// Password validation function
const validatePassword = (password) => {
  // Password must be at least 8 characters
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }

  return { valid: true };
};


const LoginUser = async (req, res) => {
  const { identifier, password } = req.body;

  const Newidentifier = identifier.toLowerCase();

  // Basic validation
  if (!Newidentifier || !password) {
    return res.status(400).json({ message: 'Login ID and password are required.' });
  }

  // Password length validation
  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters long.',
      validationError: true
    });
  }

  try {
    // Check if identifier belongs to a User
    const user = await User.findOne({
      $or: [{ userid: Newidentifier }, { email: Newidentifier }]
    });


    // Check if identifier belongs to an Organization
    const organization = await Organization.findOne({
      $or: [{ userid: Newidentifier }, { email: Newidentifier }]
    });

    // If neither a user nor an organization exists, return an error
    if (!user && !organization) {
      return res.status(401).json({ message: 'You are not logged in. Please create a new account.' });
    }

    // Determine whether it's a User or an Organization
    const account = user || organization;
    const userType = user ? "individual" : "Organization";

    // Validate password
    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    let userid = account.userid;

    userid = userid.toLowerCase();

    // Generate JWT access token (expires in 1 day)
    const accessToken = jwt.sign(
      { id: account._id, type: userType, userid: userid },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1d' }
    );

    // Generate refresh token (expires in 7 days)
    const refreshToken = jwt.sign(
      { id: account._id, type: userType, userType, userid: userid },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    // Save refresh token in the database
    account.refreshToken = refreshToken;
    await account.save();

    // If it's a user (not an organization), update their resume
    if (user) {
      // Asynchronously update user resume in the background
      generateUserResume(user._id).catch(err => {
        console.error('Error updating user resume during login:', err);
      });
    }

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true, // Always true for production HTTPS
      sameSite: "None", // Required for cross-origin
      domain: '.unifhub.fun', // This allows cookie to work on both subdomains
      path: '/',
      maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
    });

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true, // Always true for production HTTPS
      sameSite: "None", // Required for cross-origin
      domain: '.unifhub.fun', // This allows cookie to work on both subdomains
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Send response
    return res.status(200).json({
      message: 'Login successful',
      type: userType,
      user: {
        userid: account.userid,
        usertype: userType
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


const HandleRegisterUserFromGoogle = async (req, res) => {
  try {
    const { token, accountType } = req.body;
    console.log("Google authentication token:", token);
    console.log("Account type (if registering):", accountType);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Google token is required'
      });
    }

    const googleRes = await client.getToken(token);

    const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${googleRes.tokens.access_token}`
      }
    });


    if (!userRes.data || !userRes.data.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    const payload = userRes.data;
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token payload'
      });
    }

    console.log('Google payload:', payload);

    const { sub, email, name, picture } = payload;

    let account;
    let userType;
    let isNewAccount = false;



    // First check if user exists (same logic as LoginUser)
    const existingUser = await User.findOne({ email });
    const existingOrganization = await Organization.findOne({ email });

    // If both exist, there's a conflict
    if (existingUser && existingOrganization) {
      return res.status(400).json({
        success: false,
        message: 'Email exists. Please contact support.'
      });
    }

    // If user exists, login (like LoginUser logic)
    if (existingUser) {
      account = existingUser;
      userType = 'individual';
    } else if (existingOrganization) {
      account = existingOrganization;
      userType = 'organization';
    } else {
      // No existing account - this is registration
      isNewAccount = true;
      // For new registration, accountType is required
      if (!accountType || !['individual', 'Organization'].includes(accountType)) {
        return res.status(200).json({
          success: true,
          message: 'Account type is required for new registration. Must be either "individual" or "Organization"',
          isNewAccount
        });
      }

      userType = accountType;

      // Generate unique userid
      const baseUserid = email.split('@')[0].toLowerCase();
      let userid = baseUserid;
      let counter = 1;

      // Check for userid uniqueness
      while (await User.findOne({ userid }) || await Organization.findOne({ userid })) {
        userid = `${baseUserid}${counter}`;
        counter++;
      }

      if (accountType === 'individual') {
        account = new User({
          name,
          email,
          userid,
          profileImage: picture,
          password: await bcrypt.hash(sub + Date.now(), 10)
        });
      } else {
        account = new Organization({
          name,
          email,
          userid,
          profileImage: picture,
          password: await bcrypt.hash(sub + Date.now(), 10)
        });
      }
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: account._id, type: userType, userid: account.userid },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign(
      { id: account._id, type: userType, userid: account.userid }, // Removed duplicate userType
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    account.refreshToken = refreshToken;

    const tokens = {
      accessToken,
      refreshToken
    };

        console.log('Generated tokens:', tokens);
    await account.save();

    // If it's a user (not an organization), update their resume
    if (userType === 'individual') {
      generateUserResume(account._id).catch(err => {
        console.error('Error updating user resume during Google login:', err);
      });
    }

    console.log('Setting cookies for account:', account.email);
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true, // Always true for production HTTPS
      sameSite: "None", // Required for cross-origin
      domain: '.unifhub.fun', // This allows cookie to work on both subdomains
      maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
    });

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true, // Always true for production HTTPS
      sameSite: "None", // Required for cross-origin
      domain: '.unifhub.fun', // This allows cookie to work on both subdomains
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    console.log('Cookies set successfully');

    console.log('User details:', {
      email: account.email,
      name: account.name,
      profileImage: account.profileImage,
      usertype: userType,
    });

    return res.status(200).json({
      success: true,
      message: isNewAccount ? 'Registration successful' : 'Login successful',
      type: userType,
      user: {
        userid: account.userid,
        usertype: userType,
        email: account.email,
        name: account.name,
        profileImage: account.profileImage
      },
      accessToken,
      refreshToken,
      isNewAccount
    });

  } catch (error) {
    console.error('Error during Google registration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during Google authentication'
    });
  }
};

module.exports = { LoginUser, HandleRegisterUserFromGoogle };