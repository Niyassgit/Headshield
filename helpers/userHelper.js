
const Cart=require("../models/cartSchema");
const Wishlist=require("../models/wishlistSchema");


const getUserCartAndWishlistCount = async (userId) => {
  
    try {
       
        const cart = await Cart.findOne({ userId });
        const cartCount = cart ? cart.items.length : 0;

  
        const wishlist = await Wishlist.findOne({ userId });
        const wishlistCount = wishlist ? wishlist.products.length : 0;

        return { cartCount, wishlistCount };
    } catch (error) {
        console.error("Error fetching cart/wishlist counts:", error);
        return { cartCount: 0, wishlistCount: 0 };
    }
};


module.exports = {
    getUserCartAndWishlistCount
};
