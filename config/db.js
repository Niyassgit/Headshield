require("dotenv").config();
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Atlas connected successfully.");
    } catch (error) {
        console.error("❌ Error connecting to database:", error.message);
        process.exit(1); 
    }
};

module.exports = connectDB;
