const User=require("../../models/userSchema");
const Product=require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Wishlist =require("../../models/wishlistSchema");
const mongoose = require("mongoose");
const {applyBestOffer}=require("../../helpers/offerHelper");



const viewCartPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const cartData = await Cart.findOne({ userId }).populate("items.productId"); 

        if (!cartData) {
            return res.render("cartPage", {
                user: userData,
                cart: {
                    items: [],
                    cartTotal: 0, 
                    cartRegularTotal:0,
                },
            });
        }

        cartData.cartTotal = cartData.items.reduce((total, item) => total + item.totalPrice, 0); 
        cartData.cartRegularTotal = cartData.items.reduce((total, item) => total + item.totalRegularPrice, 0);

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

            const userId = req.session.user;
            
            if (!userId) {
                return res.json({ success: false, redirectUrl: '/login'});
             }

        const { productId, quantity } = req.body;  
        const cleanProductId = productId.trim(); 

    

        if (!mongoose.Types.ObjectId.isValid(cleanProductId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const objectId = new mongoose.Types.ObjectId(cleanProductId);
        await applyBestOffer(); 

        const productData=await Product.findById(objectId);
       
        
        if (!productData) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if(productData.isBlocked){
            return res.status(404).json({success:false,message:"This product cannot be added to the cart as it is blocked."})
        }
        const itemQuantity = parseInt(quantity) || 1;
    
        let cartData = await Cart.findOne({ userId });


        if (!cartData) {
            cartData = new Cart({
                userId,
                items: [],
                cartTotal: 0,
                cartRegularTotal: 0
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
            cartData.items[existingItemIndex].totalPrice = newQuantity * Number(productData.salePrice);
            cartData.items[existingItemIndex].totalRegularPrice = newQuantity * Number(productData.regularPrice);
        } else {
            cartData.items.push({
                productId: objectId,
                quantity: itemQuantity,
                price: Number(productData.salePrice),
                totalPrice: Number(productData.salePrice) * itemQuantity,
                regularPrice: Number(productData.regularPrice),
                totalRegularPrice: Number(productData.regularPrice) * itemQuantity
            });
        }
        
        cartData.cartTotal = cartData.items.reduce((total, item) => total + Number(item.totalPrice), 0);
        cartData.cartRegularTotal = cartData.items.reduce((total, item) => total + Number(item.totalRegularPrice), 0);
        
        cartData.markModified('items'); 
        await cartData.save();

        await cartData.save();
        await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId:objectId } } }
        );

        return res.status(200).json({ success: true, message: "Product added to cart!", cart: cartData });

    } catch (error) {
        console.error("Error while adding product to cart:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
const deleteItem = async (req, res) => {
    try {
        const { productId } = req.body; 
        const userId = req.session.user;
        const productObjectId = new mongoose.Types.ObjectId(productId);
        
        // Find the cart and remove the specific item
        const cartData = await Cart.findOneAndUpdate(
            { userId: userId },
            { $pull: { items: { productId: productObjectId } } },
            { new: true } // Return the updated document
        ).populate("items.productId");

        if (!cartData) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        // Recalculate totals
        cartData.cartTotal = cartData.items.length > 0
            ? cartData.items.reduce((total, item) => total + (item.totalPrice || 0), 0)
            : 0;
        
        cartData.cartRegularTotal = cartData.items.length > 0
            ? cartData.items.reduce((total, item) => total + (item.totalRegularPrice || 0), 0)
            : 0;

        await cartData.save();

        return res.status(200).json({ 
            success: true, 
            message: "Item removed from cart",
            cartTotal: cartData.cartTotal,
            cartRegularTotal: cartData.cartRegularTotal,
            remainingItems: cartData.items.length
        });

    } catch (error) {
        console.error("Error removing cart item:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.json({ success: false, redirectUrl: '/login' });
        }

        const { productId, quantity } = req.body;
        const cleanProductId = productId.trim();

        if (!mongoose.Types.ObjectId.isValid(cleanProductId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const objectId = new mongoose.Types.ObjectId(cleanProductId);
        const productData = await Product.findById(objectId);
        
        if (!productData) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        let cartData = await Cart.findOne({ userId });
        if (!cartData) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        const existingItemIndex = cartData.items.findIndex(item => 
            item.productId.toString() === objectId.toString()
        );

        if (existingItemIndex === -1) {
            return res.status(404).json({ success: false, message: "Item not found in cart" });
        }

        const newQuantity = cartData.items[existingItemIndex].quantity + parseInt(quantity);

        if (newQuantity > 5) {
            return res.status(400).json({ success: false, message: "Maximum quantity limit is 5" });
        }
        if (newQuantity > productData.quantity) {
            return res.status(400).json({ success: false, message: "Requested quantity exceeds available stock" });
        }
        if (newQuantity < 1) {
            return res.status(400).json({ success: false, message: "Minimum quantity is 1" });
        }

  
        cartData.items[existingItemIndex].quantity = newQuantity;
        cartData.items[existingItemIndex].totalPrice = newQuantity * productData.salePrice;
        cartData.items[existingItemIndex].totalRegularPrice = newQuantity * productData.regularPrice;

        cartData.cartTotal = cartData.items.reduce((total, item) => total + item.totalPrice, 0);
        cartData.cartRegularTotal = cartData.items.reduce((total, item) => total + item.totalRegularPrice, 0);

        await cartData.save();

        return res.status(200).json({ 
            success: true, 
            message: "Quantity updated successfully",
            cartTotal: cartData.cartTotal,
            cartRegularTotal: cartData.cartRegularTotal,
            newQuantity: newQuantity
        });

    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports={

    viewCartPage,
    addToCart,
    deleteItem,
    updateQuantity
}