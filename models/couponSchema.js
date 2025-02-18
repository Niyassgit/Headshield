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
        validate: {
            validator: function(value) {
                return value > Date.now(); 
            },
            message: "Expiration date must be in the future."
        }
    },
    offerPrice: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: function(value) {
                return this.type === "percentage" ? value <= 100 : true;
            },
            message: "Percentage discount must be ≤ 100."
        }
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
        default:[]
    }],
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
