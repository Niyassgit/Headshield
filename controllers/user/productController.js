const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");


const productDetails = async (req, res) => {
    try {
        const userId = req.session?.user; 
        const productId = req.query.id;

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            console.error("Invalid or missing productId:", productId);
            return res.redirect("/pageNotFound"); 
        }

        const product = await Product.findById(productId).populate("category");
        if (!product) {
            console.error("Product not found:", productId);
            return res.redirect("/pageNotFound"); 
        }

       
        let userData = null;
        if (userId) {
            userData = await User.findById(userId);
            if (!userData) {
                console.error("User not found:", userId);
                return res.redirect("/pageNotFound"); 
            }
        }

        const relatedProduct = await Product.find({
            category: product.category,
            _id: { $ne: productId }
        });

     
        res.render("product-details", {
            user: userData, 
            product: product,
            quantity: product.quantity,
            category: product.category,
            relatedProducts: relatedProduct,
        });

    } catch (error) {
        console.error("Error while rendering product details:", error);
        res.redirect("/pageNotFound"); 
    }
};

module.exports = { productDetails };
