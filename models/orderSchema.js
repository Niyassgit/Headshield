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
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
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
      enum: ["credit_card", "wallet", "cod", "upi"],
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
        "Cancelled",
        "Return Request",
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

  },{ timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
