const User=require("../../models/userSchema");
const Product=require("../../models/productSchema");
const Wishlist=require("../../models/wishlistSchema");
const mongoose = require("mongoose"); 



const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        
        const userData = await User.findById(userId);
        const wishlistData = await Wishlist.findOne({ userId })
            .populate("products.productId", "productImage productName salePrice size");

        if (!wishlistData || wishlistData.products.length === 0) {
            return res.render("wishlistPage", {
                user: userData,
                wishlist: [] 
            });
        }
        console.log('whishlist', wishlistData.products);
        

        return res.render("wishlistPage", {
            user: userData,
            wishlist: wishlistData.products  
        });

    } catch (error) {
        console.error("Error while rendering Wishlist page:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.body;

        const cleanedProductId = productId.trim();

        const product = await Product.findById(cleanedProductId);
        if (!product || product.isBlocked) {
            return res.status(404).json({ success: false, message: "Product not found or is blocked." });
        }

        const wishlist = await Wishlist.findOne({ userId });

        if (wishlist && wishlist.products.some(p => p.productId.equals(product._id))) {
            return res.status(400).json({ success: false, message: "Product is already in the wishlist." });
        }

        await Wishlist.findOneAndUpdate(
            { userId },
            { 
                $push: { products: { productId: product._id, addedOn: new Date() } }
            },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, message: "Product successfully added to wishlist." });

    } catch (error) {
        console.error("Error while adding product to Wishlist:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
const removeItem=async(req,res)=>{
try {
    const userId=req.session.user;
    const productId= req.params.productId;
    console.log("id",productId);
    const updatedWishlist = await Wishlist.findOneAndUpdate(
        { userId },
        { $pull: { products: { _id: productId } } },
        { new: true }
    );
    
    if (!updatedWishlist) {
        return res.status(404).json({ success: false, message: "Wishlist not found" });
    }
    res.json({ success: true, message: "Item removed from wishlist" });

} catch (error) {
    console.error("Error removing item:", error);
    res.status(500).json({ success: false, message: "Failed to remove item" }); 
}
}

module.exports={
    getWishlist,
    addToWishlist,
    removeItem
}