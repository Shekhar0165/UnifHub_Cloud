const AllowedOrigins = require('../config/AllowedOrigan');

class CorsCredentialsHandler {
    constructor(allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    credentials = (req, res, next) => {
        const origin = req.headers.origin;

        // Check if the origin is allowed
        if (origin && this.allowedOrigins.includes(origin)) {
            res.header("Access-Control-Allow-Origin", origin); // ✅ Allow only allowed origins
            res.header("Access-Control-Allow-Credentials", "true");
            res.header("Vary", "Origin");
            
            // Add explicit cookie settings for older browsers
            res.header("Access-Control-Expose-Headers", "Set-Cookie");
        }

        // Handle preflight (OPTIONS) requests properly
        if (req.method === "OPTIONS") {
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");  // ✅ Include OPTIONS
            res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Set-Cookie");
            res.header("Access-Control-Max-Age", "86400"); // 24 hours
            return res.sendStatus(204);  // ✅ Respond correctly to preflight requests
        }

        next();
    }
}

// Usage
const corsCredentialsHandler = new CorsCredentialsHandler(AllowedOrigins);
module.exports = corsCredentialsHandler.credentials;
