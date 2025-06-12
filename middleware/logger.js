const { format } = require('date-fns');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

class Logger {
    constructor(logDirectory = 'logs') {
        this.logDirectory = path.join(__dirname, '..', logDirectory);
    }

    async logEvents(message, logName) {
        const dateTime = `${format(new Date(), 'yyyyMMdd\tHH:mm:ss')}`;
        const logItem = `${dateTime}\t${uuid()}\t${message}\n`;

        try {
            if (!fs.existsSync(this.logDirectory)) {
                await fsPromises.mkdir(this.logDirectory);
            }

            await fsPromises.appendFile(path.join(this.logDirectory, logName), logItem);
        } catch (err) {
            console.error('Error writing log:', err);
        }
    }

    requestLogger = (req, res, next) => {
        this.logEvents(`${req.method}\t${req.headers.origin}\t${req.url}`, 'reqLog.txt');
        console.log(`${req.method} ${req.path}`);
        next();
    }
}

module.exports = Logger;
