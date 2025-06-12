const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Organization = require('../../models/Organizations');
const { generateUserResume } = require('../application/UserResume');
require('dotenv').config();

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
      { id: account._id, type: userType, userid:userid },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15min' }
    );

    // Generate refresh token (expires in 7 days)
    const refreshToken = jwt.sign(
      { id: account._id, type: userType,userType, userid:userid  },
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

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? "None" : "Lax",
      path: '/',
      maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? "None" : "Lax",
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Send response
    return res.status(200).json({
      message: 'Login successful',
      type: userType,
      user: {
        userid: account.userid,
        usertype:userType
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { LoginUser };