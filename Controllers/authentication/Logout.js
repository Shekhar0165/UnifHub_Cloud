const User = require('../../models/User');
const Organization = require('../../models/Organizations');

const LogoutUser = async (req, res) => {
    // Get refresh token from cookies or from request body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
        // No refresh token, clear cookies anyway and return success
        clearCookies(res);
        return res.status(200).json({ message: 'Logged out successfully' });
    }
    
    try {
        // Try to find the user with this refresh token
        let account = await User.findOne({ refreshToken });
        
        // If not found as a user, try to find as organization
        if (!account) {
            account = await Organization.findOne({ refreshToken });
        }
        
        // If account found, remove the refresh token
        if (account) {
            account.refreshToken = '';
            await account.save();
        }
        
        // Clear all auth cookies
        clearCookies(res);
        
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error during logout:', error);
        // Still clear cookies even if there was an error
        clearCookies(res);
        return res.status(200).json({ message: 'Logged out successfully' });
    }
};

// Helper function to clear all auth-related cookies
const clearCookies = (res) => {
    // Cookie clearing options must match the settings used when setting them
    const productionOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        domain: '.unifhub.fun', // ✅ ADD THIS - Must match login domain
        path: '/'
    };
    
    const developmentOptions = {
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        path: '/'
        // No domain for development (localhost)
    };
    
    const options = process.env.NODE_ENV === 'production' 
        ? productionOptions 
        : developmentOptions;
    
    // Clear all auth related cookies
    res.clearCookie('accessToken', options);
    res.clearCookie('refreshToken', options);
    res.clearCookie('UserId', options);
    res.clearCookie('UserType', options);
};

module.exports = { LogoutUser };