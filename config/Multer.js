const multer = require('multer');
const path = require('path');

class MulterConfig {
    constructor(directory) {
        this.directory = directory;
        this.storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, this.directory);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
            }
        });
    }

    upload() {
        return multer({ storage: this.storage });
    }
}

module.exports = MulterConfig;
