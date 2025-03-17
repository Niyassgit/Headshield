require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/userSchema");
const db = require("../config/db");

console.log("MONGODB_URI:", process.env.MONGODB_URI); 

const generateUniqueReferralCode = async () => {
    let newCode;
    let isUnique = false;
    while (!isUnique) {
        newCode = Math.random().toString(36).substr(2, 8).toUpperCase();
        const existingUser = await User.findOne({ referralCode: newCode });
        if (!existingUser) {
            isUnique = true;
        }
    }
    return newCode;
};

const updateUsersWithReferralCodes = async () => {
    try {
        await db(); 
        const usersWithoutReferralCode = await User.find({ referralCode: { $exists: false } });

        for (let user of usersWithoutReferralCode) {
            user.referralCode = await generateUniqueReferralCode();
            await user.save();
            console.log(`Updated user ${user.email} with referral code: ${user.referralCode}`);
        }

        console.log("All users updated successfully.");
        mongoose.disconnect();
    } catch (error) {
        console.error("Error updating users:", error);
        mongoose.disconnect();
    }
};

updateUsersWithReferralCodes();