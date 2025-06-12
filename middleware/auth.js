const jwt = require('jsonwebtoken');

// Middleware to verify the access token
const authenticateToken = (req, res, next) => {
    // const authHeader = req.headers['authorization'];

    // const token = authHeader && authHeader.split(' ')[1];
    const token = req.cookies.accessToken; // Access token from cookies
    // console.log("Access Token:", token);

    if (!token) {
        return res.status(401).json({ message: 'Access token is required.' });
    }

    try {
        // Verify the access token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded; 
        next();
    } catch (error) {
        console.error('Error verifying access token:', error);
        return res.status(403).json({ message: 'Invalid or expired access token.' });
    }
};

module.exports = authenticateToken;
