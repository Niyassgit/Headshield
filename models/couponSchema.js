const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    couponCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true, 
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true,
    },
    expiredOn: {
        type: Date,
        required: true,
    },
    offerPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    minimumPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    type: {
        type: String,
        enum: ["flat", "percentage"], 
        required: true,
    },
    maximumPrice:{
     type:Number,
     required:false,
    },
    usageLimit: {
        type: Number,
        default: 1, 
        min: 1,
    },
    usedCount: {
        type: Number,
        default: 0, 
    },
    isActive: {
        type: Boolean,
        default: true, 
    },
    userId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
