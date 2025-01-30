const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const productDetails = async (req, res) => {
    try {
        const userId = req.session?.user;
        const productId = req.query.id;

        // Validate userId
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            console.error("Invalid or missing userId:", userId);
            return res.redirect("/pageNotFound");
        }

        // Validate productId
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            console.error("Invalid or missing productId:", productId);
            return res.redirect("/pageNotFound");
        }

        // Fetch user data
        const userData = await User.findById(userId);
        if (!userData) {
            console.error("User not found:", userId);
            return res.redirect("/pageNotFound");
        }

        // Fetch product and populate category
        const product = await Product.findById(productId).populate("category");
        if (!product) {
            console.error("Product not found:", productId);
            return res.redirect("/pageNotFound");
        }

        res.render("product-details", {
            user: userData,
            product: product,
            quantity: product.quantity,
            category: product.category,
        });

    } catch (error) {
        console.error("Error while rendering product details:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = { productDetails };
