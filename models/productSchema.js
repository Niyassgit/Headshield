const mongoose = require("mongoose");

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    productOffer: {
      type: Number,
      default: 0,
    },
    offerExpiry: {
      type: Date,
      required: false,
      validate: {
          validator: function(value) {
              return value > Date.now(); 
          },
          message: "Expiration date must be in the future."
      }
  },
    quantity: {
      type: Number,
      default: 0, 
    },
    color: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      required: false,
    },
    productImage: {
      type: [String],
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false, 
    },
    status: {
      type: String,
      enum: ["Available", "Out of Stock", "Discontinued"], 
      required: true,
      default: "Available",
    },
    finalOffer: {
      type: Number,
      default: 0, 
    },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
