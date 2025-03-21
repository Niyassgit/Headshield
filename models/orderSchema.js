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
        regularPrice: {
          type: Number,
          default: 0,

        },
        status: {
          type: String,
          required: true,
          enum: [
            "Pending",
            "Payment Failed",
            "Confirmed",
            "Shipped",
            "Out for Delivery",
            "Delivered",
            "Cancelled",
            "Return Request",
            "Return Rejected",
            "Returned",
          ],
          default: "Pending",
        },
        cancelReason: {
          type: String,
          required: false
        },
        returnReason: {
          type: String,
          required: false
        },
        returnRequestedAt: {
          type: Date,
          default: null
        }
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
    productDiscount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Pending",
        "Payment Failed",
        "Confirmed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Return Request",
        "Return Rejected",
        "Returned",
      ],
      default: "Pending",
    },
    cancelReason: {
      type: String,
      required: false
    },
    returnReason: {
      type: String,
      required: false
    },
    address: {
      addressType: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true,
      },
      landMark: {

        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,

      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true
      },
      pincode: {
        type: Number,
        required: true
      },
      phone: {
        type: String,
        required: true
      },
      altPhone: {
        type: String,
        required: true
      }
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
    
    paymentStatus: { 
      type: String,
      enum: ["Pending", "Completed", "Failed"],
      default: "Pending",
    },
    couponApplied: {
      type: Boolean,
      default: false,
    },
   
    couponId: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      required: false,
    },
    transactionId: {
      type: String,
      default: null
    },

  }, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
