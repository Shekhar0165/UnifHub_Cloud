require('dotenv').config()
AllowedOrigan = [
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:3001',
    "https://unifhub.vercel.app",
    "https://unifhub-backend.vercel.app",
    "https://unifhiub-backend.vercel.app",
    "https://unifhub-backend.onrender.com",
    "http://13.203.171.150:3000",
    "http://10.200.1.126:3000",
    "https://unifhub.fun",
    "https://devunifhub.vercel.app",
    process.env.CLIENT_URL
]

module.exports = AllowedOrigan