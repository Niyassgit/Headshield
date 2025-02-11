const Order=require("../../models/orderSchema");
const User=require("../../models/userSchema");
const Product=require("../../models/productSchema");
const Cart =require("../../models/cartSchema");
const Address = require("../../models/addressSchema");


const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user; 
        const { address, paymentMethod} = req.body;

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
            productId: item.productId._id,
            productName:item.productId.productName,
            quantity: item.quantity,
            price: item.price
        }));

        const totalPrice = cart.cartTotal;
        let  discount=0;
        const finalAmount = totalPrice;
        let couponNotApplied=false;

        let status = 'Shipped';

        // Create order
        const order = await Order.create({
            userId,
            orderedItems,
            totalPrice,
            discount,
            finalAmount,
            address: address,
            paymentMethod:paymentMethod,
            invoiceDate: new Date(),
            status,
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
        const orderData = await Order.find({ userId: userId })
         .populate("orderedItems.productId", "productName productImage size color"); 
        if(!orderData){
            console.error("Error while fetching order list:",error);
            return res.status(404).json({success:false,message:"failed to find Orders"});
        }

        return res.render("Orders",{
            user:userData,
            order:orderData,
        })
    } catch (error) {
        console.error("Error while rendering Orders page",error);
        res.status(500).json({success:false,message:"Internal Server Error"});
    }
};
const getOrderDetails=async(req,res)=>{
    try {
        const userId=req.session.user;
        const userData= await User.findById(userId);
        const orderId=req.query.id;
        const orderData=await Order.findOne({orderId:orderId}).populate("orderedItems.productId", "productName productImage").exec();
        if(!orderData){
            console.log("error fetching order Data:",error);
            return res.status(400).json({success:false,message:"Failed to find the order"});
        }
        const addressDoc = await Address.findOne({ userId: orderData.userId });
        let selectedAddress = null;

        if (addressDoc && addressDoc.address.length > 0) {
          selectedAddress = addressDoc.address.find((addr) =>
            addr._id.equals(orderData.address)
          );
        }
        const products = orderData.orderedItems.map(item => ({
            productImage: item.productId?.productImage || 'default-image.jpg', 
            productName: item.productName,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
          }));
  

        return res.render("orderDetail",{
            user:userData,
            order:orderData,
            address:selectedAddress,
            products:products
        })
        
    } catch (error) {
        console.error("Error while rendering order details:",error);
        return res.status(500).json({success:false,message:"Internal; server issue",error });
        
    }
};



module.exports = {
    placeOrder,
    getOrders,
    getOrderDetails,
  
};
