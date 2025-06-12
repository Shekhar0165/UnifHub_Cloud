const CloudinaryConfig = require('../config/CloudinaryConfig');
const fs = require('fs').promises;

class MulterToCloudinary {
    /**
     * Middleware to upload files from multer to Cloudinary after multer processes them
     * @param {string} folder - The folder in Cloudinary to store the file
     */
    static uploadToCloudinary = (folder) => async (req, res, next) => {
        try {
            // Check if there are files uploaded
            if (!req.file && (!req.files || Object.keys(req.files).length === 0)) {
                // No files to upload, continue to next middleware
                return next();
            }

            // Function to upload a single file to Cloudinary
            const uploadSingleFile = async (file) => {
                try {
                    // Upload to Cloudinary
                    const result = await CloudinaryConfig.uploadFile(file, folder);
                    
                    if (!result.success) {
                        throw new Error(result.error);
                    }

                    // Add Cloudinary info to the file object
                    file.cloudinary = {
                        url: result.url,
                        public_id: result.public_id
                    };

                    // Delete local file after upload
                    await fs.unlink(file.path);

                    return result;
                } catch (error) {
                    console.error('Error in uploadSingleFile:', error);
                    throw error;
                }
            };

            // Handle single file upload
            if (req.file) {
                await uploadSingleFile(req.file);
            }

            // Handle multiple files upload
            if (req.files) {
                // For fields with multiple files (array of files)
                if (Array.isArray(req.files)) {
                    await Promise.all(req.files.map(file => uploadSingleFile(file)));
                }
                // For fields with single file per field (object of fields)
                else {
                    for (const field in req.files) {
                        if (Array.isArray(req.files[field])) {
                            await Promise.all(req.files[field].map(file => uploadSingleFile(file)));
                        } else {
                            await uploadSingleFile(req.files[field]);
                        }
                    }
                }
            }

            next();
        } catch (error) {
            console.error('Error in MulterToCloudinary middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Error uploading file to Cloudinary',
                error: error.message
            });
        }
    };

    static async deleteFromCloudinary(publicId) {
        return await CloudinaryConfig.deleteFile(publicId);
    }
}

module.exports = MulterToCloudinary;
