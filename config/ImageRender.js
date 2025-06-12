const path = require('path');
const fs = require('fs');

class ImageRenderer {
    constructor(directory) {
        this.directory = directory;
    }

    renderImage(req, res) {
        const filePath = path.join(__dirname, this.directory, req.params.filename);

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                return res.status(404).send('File not found');
            }

            const ext = path.extname(filePath).toLowerCase();
            let contentType = 'image/jpeg'; // Default to jpeg

            if (ext === '.png') contentType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

            res.setHeader('Content-Type', contentType);

            const stream = fs.createReadStream(filePath);
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                res.status(500).send('Error streaming the file');
            });

            stream.pipe(res);
        });
    }
}

module.exports = ImageRenderer;
