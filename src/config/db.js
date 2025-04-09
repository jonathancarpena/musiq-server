const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {

    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

// Correct export for Node.js (CommonJS)
module.exports = connectDB;
