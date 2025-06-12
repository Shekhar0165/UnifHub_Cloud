const Logger = require('./logger'); // Importing the Logger class

class ErrorHandler {
    constructor(logFile = 'errLog.txt') {
        this.logFile = logFile;
        this.logger = new Logger(); // Instantiate Logger class
    }

    handleError = (err, req, res, next) => {
        // Log the error details to the specified log file
        this.logger.logEvents(`${err.name}: ${err.message}`, this.logFile);
        
        // Print the error stack trace to the console
        console.error(err.stack);
        
        // Send a 500 status code response with the error message to the client
        res.status(500).send(err.message);
    }
}

module.exports = ErrorHandler;
