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
const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.query.orderId; 
        const orderData = await Order.findOne({ _id: orderId })
            .populate("orderedItems.productId", "productName productImage")
            .exec();
        if (!orderData) {
            return res.status(404).json({ success: false, message: "Failed to find the order" });
        }
  
        const products = orderData.orderedItems.map(item => ({
            productImage: item.productId?.productImage || ['default-image.jpg'],
            productName: item.productName,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            status: item.status,
            productId: item.productId?._id ? item.productId._id.toString() : 'missing', 
            cancelReason: item.cancelReason || '',
            returnReason: item.returnReason || ''
        }));
  
  
        return res.status(200).render("orderDetails", {
            orders: orderData,
            products: products
        });
    } catch (error) {
        console.error("Error in order details page", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
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

        order.orderedItems.forEach(item => {
            if (item.status !== "Cancelled" && item.status !== "Returned") {
                item.status = status;
            }
        });

       
        order.status = status;
        const updatedOrder = await order.save(); 


        if (status === "Returned") {
            for (let item of order.orderedItems) {
                if (item.status === "Returned") { 
                    await Product.updateOne(
                        { _id: item.productId },
                        { $inc: { quantity: item.quantity } }
                    );
                }
            }

            if (order.paymentMethod === "razorpay" || order.paymentMethod === "wallet") {
                const refundAmount = order.finalAmount; 
                const orderIdStr = order.orderId;

                const wallet = await Wallet.findOneAndUpdate(
                    { userId: order.userId },
                    {
                        $inc: { balance: refundAmount },
                        $push: {
                            transactions: {
                                transactionType: "credit",
                                amount: refundAmount,
                                description: `Refund for Order #${order._id}`,
                                createdAt: new Date(),
                                status: "Completed",
                                orderId: orderIdStr
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

const returnSingleProductAdmin = async (req, res) => {
    try {
        const { orderId, productId } = req.params; 
        const { status } = req.body; 

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const itemIndex = order.orderedItems.findIndex(item => item.productId.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }

        const item = order.orderedItems[itemIndex];
        if (item.status !== "Return Request") {
            return res.status(400).json({ success: false, message: "No return request pending for this item" });
        }


        item.status = status;

        if (status === "Returned") {
            const itemTotal = item.price * item.quantity;

        
            order.totalPrice = (order.totalPrice || 0) - itemTotal;

            order.finalAmount = (order.finalAmount || 0) - itemTotal;


            const totalItems = order.orderedItems.length;
            const discountPerItem = (order.productDiscount || 0) / totalItems;
            order.productDiscount = (order.productDiscount || 0) - discountPerItem;

            order.totalPrice = Math.max(order.totalPrice, 0);
            order.finalAmount = Math.max(order.finalAmount, 0);
            order.productDiscount = Math.max(order.productDiscount, 0);


            await Product.updateOne(
                { _id: item.productId },
                { $inc: { quantity: item.quantity } }
            );

            if (order.paymentMethod === "razorpay" || order.paymentMethod === "wallet") {
                const refundAmount = itemTotal; 
                await Wallet.findOneAndUpdate(
                    { userId: order.userId },
                    {
                        $inc: { balance: refundAmount },
                        $push: {
                            transactions: {
                                transactionType: "credit",
                                amount: refundAmount,
                                description: `Refund for returned item in Order #${order.orderId}`,
                                createdAt: new Date(),
                                status: "Completed",
                                orderId: order.orderId
                            }
                        }
                    },
                    { new: true, upsert: true }
                );
            }
        }

        const allProcessed = order.orderedItems.every(item => 
            ["Cancelled", "Returned", "Return Rejected"].includes(item.status)
        );
        if (allProcessed) {
            order.status = status;
        }

        await order.save();

        return res.json({ 
            success: true, 
            message: `Return request ${status === "Returned" ? "sanctioned" : "rejected"} successfully` 
        });
    } catch (error) {
        console.error("Error in returnSingleProductAdmin:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports={

    getOrderslist,
    getOrderDetails,
    updateStatus,
    cancelOrder,
    returnSingleProductAdmin

}
