const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema(
  {
    orderId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
    },
    userId: { 
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderedItems: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productName: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          default: 0,
        },
        regularPrice:{
          type:Number,
          default:0,

        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
    productDiscount:{
     type:Number,
     default:0,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    address: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "wallet", "razorpay"],
      required: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Pending",
        "Processing",
        "Shipped",
        "Delivered",
        "Out for Delivery",
        "Cancelled",
        "Return Request",
        "Return Rejected",
        "Returned",
      ],
      default: "Pending",
    },
    couponApplied: {
      type: Boolean,
      default: false,
    },
     cancelReason:{
      type:String,
      required:false
    },
    returnReason:{
      type:String,
      required:false
    },
    couponId:{
      type: Schema.Types.ObjectId,
      ref:"Coupon",
      required:false,
    },
    transactionId:{
      type:String,
      default:null
    },

  },{ timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
