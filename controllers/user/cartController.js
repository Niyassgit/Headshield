const User=require("../../models/userSchema");
const Product=require("../../models/productSchema");
const cart=require("../../models/cartSchema");
const Cart = require("../../models/cartSchema");
const mongoose = require("mongoose");


const viewCartPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const cartData = await Cart.findOne({ userId }).populate("items.productId"); // Fixing to use `findOne` instead of `findById`

        // If no cart data is found, return an empty cart
        if (!cartData) {
            return res.render("cartPage", {
                user: userData,
                cart: {
                    items: [],
                    cartTotal: 0, // Ensure it's named as cartTotal for consistency
                },
            });
        }

        // Calculate total price of items in the cart
        cartData.cartTotal = cartData.items.reduce((total, item) => total + item.totalPrice, 0); // Fix the syntax error here

        // Render cart page with the cart data
        return res.render("cartPage", {
            user: userData,
            cart: cartData,
        });
    } catch (error) {
        console.error("Error while rendering cart page", error);
        res.status(500).send("Failed to load cart");
    }
};


const addToCart = async (req, res) => {
    try {
        console.log("Checking if user is logged in...");


            const userId = req.session.user;
            
            if (!userId) {
                return res.json({ success: false, redirectUrl: '/login' });
              }

        const { productId, productQuantity } = req.body;  
        const cleanProductId = productId.trim(); 

    

        if (!mongoose.Types.ObjectId.isValid(cleanProductId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const objectId = new mongoose.Types.ObjectId(cleanProductId);

        const productData=await Product.findById(objectId);
        if (!productData) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (!productData.salePrice || isNaN(productData.salePrice)) {
            return res.status(404).json({ success: false, message: "Invalid Product Price" });
        }

    
        const itemQuantity = parseInt(productQuantity) || 1;
    
        let cartData = await Cart.findOne({ userId });

        const totalPrice = productData.salePrice * itemQuantity;

        if (!cartData) {
            cartData = new Cart({
                userId,
                items: [],
                cartTotal: 0
            });
        }

        const existingItemIndex = cartData.items.findIndex(item => item.productId.toString() === objectId.toString());

        if (existingItemIndex > -1) {
            let newQuantity = Number(cartData.items[existingItemIndex].quantity) + Number(itemQuantity);

            if (newQuantity > 5) {
                return res.status(400).json({ success: false, message: "You can only order up to 5 items" });
            }
            if (newQuantity > productData.quantity) {
                return res.status(400).json({ success: false, message: "You cannot order more than available stock" });
            }
            if (newQuantity < 1) {
                return res.status(400).json({ success: false, message: "You cannot order less than 1 item" });
            }

            cartData.items[existingItemIndex].quantity = newQuantity;
            cartData.items[existingItemIndex].totalPrice = newQuantity * productData.salePrice;
            
        } else {
            cartData.items.push({
                productId: objectId,
                productQuantity: itemQuantity,
                price: productData.salePrice,
                totalPrice: productData.salePrice * itemQuantity
            });
        }

        cartData.cartTotal = cartData.items.reduce((total, item) => total + item.totalPrice, 0);

        await cartData.save();

        return res.status(200).json({ success: true, message: "Product added to cart!", cart: cartData });

    } catch (error) {
        console.error("Error while adding product to cart:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};  

module.exports={

    viewCartPage,
    addToCart,
}