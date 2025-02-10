const Order=require("../../models/orderSchema");
const User=require("../../models/userSchema");
const Product=require("../../models/productSchema");
const Cart =require("../../models/cartSchema");
const Address = require("../../models/addressSchema");


const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user; 
        const { address, paymentMethod} = req.body;

        console.log(address,paymentMethod)

        if (!address || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Address and payment method are required'
            });
        }

        const cart = await Cart.findOne({ userId })
            .populate('items.productId');

        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        const orderedItems = cart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.price
        }));

        const totalPrice = cart.cartTotal;
        let  discount=0;
        const finalAmount = totalPrice;
        let couponNotApplied=false;

        let status = 'Pending';

        // Create order
        const order = await Order.create({
            orderedItems,
            totalPrice,
            discount,
            finalAmount,
            address: address,
            status,
            invoiceDate: new Date(),
            couponApplied:couponNotApplied
        });

         
        await Cart.findByIdAndDelete(cart._id);
       return  res.status(200).json({success: true, message: "Order placed successfully!", order });

    } catch (error) {
        console.error('Place order error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to place order',
            error: error.message
        });
    }
};
const getOrders= async(req,res)=>{
    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);

        return res.render("Orders",{
            user:userData,
        })
    } catch (error) {
        console.error("Error while rendering Orders page",error);
        
    }
}

module.exports = {
    placeOrder,
    getOrders,
};
