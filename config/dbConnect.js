const mongoose = require('mongoose');

class Database {
    constructor(uri, options = {}) {
        this.uri = uri;
        // Add default options to ensure best practices
        this.options = {
            useUnifiedTopology: true,
            useNewUrlParser: true,
            ...options // Merge additional options passed by the user
        };
    }

    connect = async () => {
        try {
            await mongoose.connect(this.uri, this.options);
            console.log('MongoDB connection successful');
        } catch (error) {
            console.error('MongoDB connection error:', error);
        }
    }

    disconnect = async () => {
        try {
            await mongoose.disconnect();
            console.log('MongoDB disconnected');
        } catch (err) {
            console.error('Disconnection error:', err);
        }
    }    
}

const dbconnect = new Database(process.env.DATABASE_URI)

module.exports = dbconnect;
