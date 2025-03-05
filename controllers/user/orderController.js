const Order=require("../../models/orderSchema");
const User=require("../../models/userSchema");
const Product=require("../../models/productSchema");
const Cart =require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Coupon =require("../../models/couponSchema");
const Wallet=require("../../models/walletSchema");
const axios = require("axios");



const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { address, paymentMethod, totalPrice, discount, finalAmount, couponCode, razorpay_payment_id, paymentStatus: clientPaymentStatus } = req.body;

        if (!address || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Address and payment method are required'
            });
        }

        const userAddress = await Address.findOne(
            { userId, "address._id": address },
            { "address.$": 1 }
        );
        if (!userAddress || !userAddress.address[0]) {
            return res.status(400).json({
                success: false,
                message: "Address not found or invalid"
            });
        }
        const selectedAddress = userAddress.address[0];

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'productName quantity isBlocked savedAmount regularPrice'
        });
        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }


        const outOfStockItems = [];
        const blockedItems = [];
        for (let item of cart.items) {
            if (item.productId.quantity < item.quantity) {
                outOfStockItems.push(item.productId.productName);
            }
            if (item.productId.isBlocked) {
                blockedItems.push(item.productId.productName);
            }
        }
        if (blockedItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: `The following products are blocked: ${blockedItems.join(", ")}`
            });
        }
        if (outOfStockItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: `These products are out of stock: ${outOfStockItems.join(", ")}`
            });
        }

        const orderedItems = cart.items.map(item => ({
            productId: item.productId._id,
            productName: item.productId.productName,
            regularPrice: item.productId.regularPrice,
            quantity: item.quantity,
            price: item.price
        }));

        let couponApplied = false;
        let couponId = null;
        let finalDiscount = 0;

        if (couponCode) {
            const coupon = await Coupon.findOne({ couponCode: couponCode });

            if (coupon) {
            
                if (!coupon.isActive) {
                    return res.status(400).json({
                        success: false,
                        message: 'This coupon is inactive.'
                    });
                }

                if (coupon.expiredOn < Date.now()) {
                    return res.status(400).json({
                        success: false,
                        message: 'This coupon has expired.'
                    });
                }

                if (coupon.usedCount >= coupon.usageLimit) {
                    return res.status(400).json({
                        success: false,
                        message: 'This coupon has reached its usage limit.'
                    });
                }

                couponApplied = true;
                couponId = coupon._id;

                let discountAmount = 0;
                if (coupon.type === 'percentage') {
                    discountAmount = (totalPrice * coupon.offerPrice) / 100;
                } else {
                    discountAmount = coupon.offerPrice;
                }


                if (coupon.maximumPrice && discountAmount > coupon.maximumPrice) {
                    discountAmount = coupon.maximumPrice;
                }

                finalDiscount = discountAmount;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coupon code.'
                });
            }
        }


        let savedAmount = 0;
        cart.items.forEach(item => {
            savedAmount += (item.productId.savedAmount || 0) * item.quantity; 
        });

      
        const calculatedFinalAmount = totalPrice - finalDiscount;
        if (finalAmount !== calculatedFinalAmount) {
            console.warn(`Final amount mismatch: Client sent ${finalAmount}, calculated ${calculatedFinalAmount}`);
        }

        let paymentStatus = clientPaymentStatus || "Pending"; 
        let status = "Pending";

        if (paymentStatus === "Failed") {
            const existingOrder = await Order.findOne({
                userId,
                totalPrice,
                paymentStatus: "Failed",
                status: "Payment Failed",
                invoiceDate: { $gte: new Date(Date.now() - 5 * 60 * 1000) } 
            });
            if (existingOrder) {
                console.log("Duplicate Payment Failed order detected:", existingOrder.orderId);
                return res.status(200).json({
                    success: true,
                    message: "Order already created with payment failed. Retry from order details.",
                    orderId: existingOrder.orderId
                });
            }
        }

        if (paymentMethod === "cod") {
            if (totalPrice > 10000) {
                return res.status(400).json({
                    success: false,
                    message: "Cash on Delivery is not available for orders above ₹10000."
                });
            }
        } else if (paymentMethod === "wallet") {
            const wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < calculatedFinalAmount) {
                return res.status(400).json({
                    success: false,
                    message: !wallet ? "Wallet not found!" : "Insufficient wallet balance!"
                });
            }
            await Wallet.findOneAndUpdate(
                { userId },
                { $inc: { balance: -calculatedFinalAmount } }
            );
            paymentStatus = "Completed";
            status = "Confirmed";
        } else if (paymentMethod === "razorpay") {
            if (paymentStatus === "Failed") {
                status = "Payment Failed";
            } else if (!razorpay_payment_id) {
                paymentStatus = "Failed";
                status = "Payment Failed";
            } else {
                try {
                    const response = await axios.get(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
                        auth: {
                            username: process.env.RAZORPAY_KEY_ID,
                            password: process.env.RAZORPAY_KEY_SECRET
                        }
                    });
                    paymentStatus = response.data.status === "captured" ? "Completed" : "Failed";
                    status = paymentStatus === "Completed" ? "Confirmed" : "Payment Failed";
                } catch (error) {
                    console.error("Razorpay verification error:", error.message);
                    paymentStatus = "Failed";
                    status = "Payment Failed";
                }
            }
        }


        const order = await Order.create({
            userId,
            orderedItems,
            totalPrice,
            couponDiscount: finalDiscount,
            productDiscount: savedAmount,
            finalAmount: calculatedFinalAmount,
            address: selectedAddress,
            paymentMethod,
            invoiceDate: new Date(),
            status,
            couponApplied,
            couponId,
            transactionId: razorpay_payment_id || null,
            paymentStatus
        });

     
 
     const isOrderSuccessful = status === "Confirmed" || status === "Pending";

     if (isOrderSuccessful) {
         if (couponApplied) {
             await Coupon.findByIdAndUpdate(couponId, {
                 $push: { userId: userId },
                 $inc: { usedCount: 1 }
             });
         }
         if (paymentMethod === "wallet" && paymentStatus === "Completed") {
             await Wallet.findOneAndUpdate(
                 { userId },
                 {
                     $push: {
                         transactions: {
                             transactionType: 'debit',
                             amount: calculatedFinalAmount,
                             description: 'Order placed using wallet',
                             status: 'Completed',
                             orderId: order.orderId
                         }
                     }
                 }
             );
         }
         for (let item of cart.items) {
             await Product.updateOne(
                 { _id: item.productId._id },
                 { $inc: { quantity: -item.quantity } }
             );
         }
     }

     
     await Cart.findByIdAndDelete(cart._id);

     return res.status(200).json({
         success: true,
         message: paymentStatus === "Failed" ? "Order created with payment failed. Retry from order details." : "Order placed successfully!",
         orderId: order.orderId
     });
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
         .populate("orderedItems.productId", "productName productImage size color")
         .sort({createdAt:-1}); 
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
            price: item.regularPrice,
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
        return res.status(500).json({success:false,message:"Internal; server issue"});
        
    }
};
const cancelOrder = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;
  
    try {

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found!" });
      }

      const productPrice = order.finalAmount;
      const orderId=order.orderId;
  
      if (order.paymentMethod === "razorpay" || order.paymentMethod === "wallet") {

        await Order.updateOne(
          { _id: id },
          {
            status: "Cancelled",
            cancelReason: reason,
          },
          { new: true }
        );
  
        for (let item of order.orderedItems) {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { quantity: item.quantity } }
          );
        }
  
        const wallet = await Wallet.findOneAndUpdate(
          { userId: userId },
          {
            $inc: { balance: productPrice },
            $push: {
              transactions: {
                transactionType: "credit",
                amount: productPrice,
                description: `Refund for Order #${order.orderId}`,
                createdAt: new Date(),
                status: "Completed",
                orderId:orderId,
              },
            },
          },
          { new: true }
        );
  

        if (!wallet) {
          await Wallet.create({
            userId: userId,
            balance: productPrice,
            transactions: [
              {
                transactionType: "credit",
                amount: productPrice,
                description: `Refund for Order #${order.orderId}`,
                createdAt: new Date(),
                status: "Completed",
              },
            ],
          });
        }
      } else {
        await Order.updateOne(
          { _id: id },
          {
            status: "Cancelled",
            cancelReason: reason,
          },
          { new: true }
        );
  
        for (let item of order.orderedItems) {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { quantity: item.quantity } }
          );
        }
      }
  
      return res.status(200).json({
        success: true,
        message: "Order cancelled and refund processed successfully.",
      });
    } catch (error) {
      console.error("Error canceling order", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  };
  

const returnOrder=async(req,res)=>{
        const {id}=req.params;
        const {reason}=req.body;
    try {
        
        const order=await Order.findByIdAndUpdate(id,
            {status:"Return Request",returnReason:reason},{new:true}
        );
        
        if(!order){

            return res.status(404).json({success:false,message:"Failed to find the order"})
           }
    
           return res.status(200).json({success:true,message:"Return request submitted Successfully"});
        
    } catch (error) {
        console.error("Error while retrun request",error);
        return res.status(500).json({success:false,message:"internal Server Error"});
        
    }
};
const getOrderAmount = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.paymentStatus === "Completed") {
            return res.status(400).json({ success: false, message: "Payment already completed" });
        }

        return res.status(200).json({
            success: true,
            amount: order.finalAmount
        });
    } catch (error) {
        console.error("Error fetching order amount:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
 
const updatePayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { razorpay_payment_id } = req.body;

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (!razorpay_payment_id) {
            return res.status(400).json({ success: false, message: "Payment ID required" });
        }

        const response = await axios.get(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
            auth: {
                username: process.env.RAZORPAY_KEY_ID,
                password: process.env.RAZORPAY_KEY_SECRET
            }
        });

        if (response.data.status === "captured") {
            order.paymentStatus = "Completed";
            order.status = "Confirmed";
            order.transactionId = razorpay_payment_id;
            await order.save();

            // Update product quantities if not already done
            for (let item of order.orderedItems) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { quantity: -item.quantity } }
                );
            }

            return res.status(200).json({
                success: true,
                message: "Payment completed successfully"
            });
        } else {
            order.paymentStatus = "Failed";
            order.status = "Payment Failed";
            await order.save();

            return res.status(400).json({
                success: false,
                message: "Payment verification failed"
            });
        }
    } catch (error) {
        console.error("Error updating payment:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
const markPaymentAsFailed = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        order.paymentStatus = "Failed";
        order.status = "Payment Failed";
        await order.save();

        return res.status(200).json({ success: true, message: "Payment marked as failed" });
    } catch (error) {
        console.error("Error marking payment as failed:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const successPage=async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);


        return res.render("successPage",{
            user:userData,

        })
        
    } catch (error) {
        
    }
};

module.exports = {
    placeOrder,
    getOrders,
    getOrderDetails,
    cancelOrder,
    returnOrder,
    getOrderAmount,
    updatePayment,
    markPaymentAsFailed,
    successPage,
  
};
