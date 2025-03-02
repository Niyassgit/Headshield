const Order=require("../../models/orderSchema");
const User=require("../../models/userSchema");
const Address=require("../../models/addressSchema");
const Product=require("../../models/productSchema"); 
const Wallet =require("../../models/walletSchema");   


const getOrderslist = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = 5;
        let skip = (page - 1) * limit;
        
        let searchQuery = req.query.search || '';
        
        let searchConditions = {};
        if (searchQuery) {
            searchConditions = {
                $or: [
                    { orderId: { $regex: searchQuery, $options: 'i' } },
                    { status: { $regex: searchQuery, $options: 'i' } },
                    { totalPrice: searchQuery.match(/^[0-9]+$/) ? parseInt(searchQuery) : null }
                ]
            };
            
    
            const userIds = await User.find(
                { name: { $regex: searchQuery, $options: 'i' } },
                { _id: 1 }
            );
            if (userIds.length > 0) {
                searchConditions.$or.push({ userId: { $in: userIds } });
            }
        }

     
        const totalOrders = await Order.countDocuments(searchConditions);
        
        const orders = await Order.find(searchConditions)
            .populate("userId", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        if (!orders) {
            return res.status(404).json({ success: false, message: "Cannot find orders" });
        }

        let totalPage = Math.ceil(totalOrders / limit);

        return res.render("ordersList", {
            orders: orders,
            currentPage: page,
            totalPage: totalPage,
            search: searchQuery 
        });

    } catch (error) {
        console.error("Error while rendering orders list", error);
        return res.redirect("/admin-error");
    }
};
const getOrderDetails=async(req,res)=>{
    try {
        const orderId=req.query.orderId;
        const orderData=await Order.findOne({_id:orderId}).populate("orderedItems.productId", "productName productImage").exec();
        if(!orderData){
            return res.status(404).json({success:false,message:"Failed to find the order"})
        }
    

       const products = orderData.orderedItems.map(item => ({
        productImage: item.productId?.productImage || 'default-image.jpg', 
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity
      }))

       return res.status(200).render("orderDetails",{
          orders:orderData,
          products:products
        })
    } catch (error) {
        console.error("Errror in order details page",error);
        return res.status(500).json({success:false,message:"Internal Server Error"});
        
    }
};
const updateStatus = async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
  
      if (order.status === "Returned" && status === "Returned") {
        return res.status(400).json({ success: false, message: "Order has already been returned" });
      }
  

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { status: status },
        { new: true }
      );
  
    
      if (status === "Returned") {
        for (let item of order.orderedItems) {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { quantity: item.quantity } }
          );
        }

        if (order.paymentMethod === "razorpay" || order.paymentMethod === "wallet") {
          const productPrice = order.finalAmount;
          const orderId=order.orderId
  
          const wallet = await Wallet.findOneAndUpdate(
            { userId: order.userId },
            {
              $inc: { balance: productPrice },
              $push: {
                transactions: {
                  transactionType: "credit",
                  amount: productPrice,
                  description: `Refund for Order #${order._id}`,
                  createdAt: new Date(),
                  status: "Completed",
                  orderId:orderId
                },
              },
            },
            { new: true, upsert: true } 
          );
        }
      }
  
      return res.json({
        success: true,
        message: "Order status updated successfully",
        order: updatedOrder,
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
  
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }

        const order = await Order.findOneAndUpdate(
            { _id: orderId }, 
            { status: "Cancelled" }, 
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        return res.json({ success: true, message: "Order cancelled successfully" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


module.exports={

    getOrderslist,
    getOrderDetails,
    updateStatus,
    cancelOrder,

}
