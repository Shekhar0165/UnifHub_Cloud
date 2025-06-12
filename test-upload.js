const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

async function loginUser() {
    try {
        const response = await axios.post('http://localhost:8000/auth/login', {
            email: 'shekharkashyap913@gmail.com',    // Replace with a valid user
            password: 'Qwerty@123'      // Replace with valid password
        });
        return response.data.accessToken;
    } catch (error) {
        console.error('Login error:', error.response?.data || error.message);
        throw error;
    }
}

async function testImageUpload(token) {
    try {
        // Create a test image file
        const imageContent = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 transparent GIF
        const imagePath = path.join(__dirname, 'public', 'post', 'test.jpg');
        fs.writeFileSync(imagePath, Buffer.from(imageContent, 'base64'));

        const formData = new FormData();
        formData.append('title', 'Test Post');
        formData.append('description', 'Testing Image Upload');
        formData.append('content', 'This is a test post');
        formData.append('postImage', fs.createReadStream(imagePath));

        const response = await axios.post('http://localhost:8000/api/post/add', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

async function main() {
    try {
        const token = await loginUser();
        await testImageUpload(token);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

main();
