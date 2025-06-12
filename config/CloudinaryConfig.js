const cloudinary = require('cloudinary').v2;
require('dotenv').config();


// Configure Cloudinary with credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryConfig {
    static async uploadFile(file, folder) {
        try {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: folder,
                resource_type: 'auto'
            });

            return {
                success: true,
                url: result.secure_url,
                public_id: result.public_id
            };
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    static async deleteFile(publicId) {
        try {
            await cloudinary.uploader.destroy(publicId);
            return {
                success: true,
                message: 'File deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting from Cloudinary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = CloudinaryConfig;
