const AllowedOrigan = require('./AllowedOrigan')
class CorsHandler {
    constructor(allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    validateOrigin(origin, callback) {
        // Check if the origin is allowed or it's a server-side request with no origin
        if (this.allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);  // Origin allowed
        } else {
            callback(new Error('Not allowed by CORS'));  // Origin not allowed
        }
    }

    getCorsOptions() {
        return {
            origin: (origin, callback) => {
                this.validateOrigin(origin, callback);
            },
            credentials: true, 
            optionsSuccessStatus: 200,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        };
    }
    
}

// Usage

const corsHandler = new CorsHandler(AllowedOrigan);
const corsOptions = corsHandler.getCorsOptions();

module.exports = corsOptions;
