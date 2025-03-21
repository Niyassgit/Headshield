const Order=require("../../models/orderSchema");
const User=require("../../models/userSchema");
const Product=require("../../models/productSchema");
const Cart =require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Coupon =require("../../models/couponSchema");
const Wallet=require("../../models/walletSchema");
const axios = require("axios");
const puppeteer=require("puppeteer");
const fs = require("fs");
const path = require("path");


const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { address, paymentMethod, totalPrice, discount, couponCode, razorpay_payment_id, paymentStatus: clientPaymentStatus } = req.body;

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

        // Calculate saved amount for product discounts
        let savedAmount = 0;
        cart.items.forEach(item => {
            savedAmount += (item.productId.savedAmount || 0) * item.quantity;
        });

        // Determine initial payment and order status
        let paymentStatus = clientPaymentStatus || "Pending";
        let status = "Pending";

        if (paymentMethod === "cod") {
            if (totalPrice > 10000) {
                return res.status(400).json({
                    success: false,
                    message: "Cash on Delivery is not available for orders above ₹10000."
                });
            }
            status = "Pending"; // COD remains Pending
        } else if (paymentMethod === "wallet") {
            const wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < totalPrice) {
                return res.status(400).json({
                    success: false,
                    message: !wallet ? "Wallet not found!" : "Insufficient wallet balance!"
                });
            }
            await Wallet.findOneAndUpdate(
                { userId },
                { $inc: { balance: -totalPrice } }
            );
            paymentStatus = "Completed";
            status = "Confirmed"; // Wallet payment is immediate
        } else if (paymentMethod === "razorpay") {
            if (paymentStatus === "Failed" || !razorpay_payment_id) {
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

        // Check for duplicate failed payment orders
        if (paymentStatus === "Failed") {
            const existingOrder = await Order.findOne({
                userId,
                totalPrice,
                paymentStatus: "Failed",
                status: "Payment Failed",
                invoiceDate: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
            });
            if (existingOrder) {
             
                return res.status(200).json({
                    success: true,
                    message: "Order already created with payment failed. Retry from order details.",
                    orderId: existingOrder.orderId
                });
            }
        }

        // Map cart items to orderedItems with status matching the order status
        const orderedItems = cart.items.map(item => ({
            productId: item.productId._id,
            productName: item.productId.productName,
            regularPrice: item.productId.regularPrice,
            quantity: item.quantity,
            price: item.price,
            status: status // Set individual item status to match order status
        }));

        // Coupon handling
        let couponApplied = false;
        let couponId = null;
        if (couponCode) {
            const coupon = await Coupon.findOne({ couponCode: couponCode });
            if (!coupon) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coupon code.'
                });
            }
            if (!coupon.isActive || coupon.expiredOn < Date.now() || coupon.usedCount >= coupon.usageLimit) {
                return res.status(400).json({
                    success: false,
                    message: coupon.isActive ? (coupon.expiredOn < Date.now() ? 'This coupon has expired.' : 'This coupon has reached its usage limit.') : 'This coupon is inactive.'
                });
            }
            couponApplied = true;
            couponId = coupon._id;
        }

        let finalTotal = totalPrice + discount + savedAmount;

        // Create the order
        const order = await Order.create({
            userId,
            orderedItems,
            totalPrice: finalTotal,
            couponDiscount: discount,
            productDiscount: savedAmount,
            finalAmount: totalPrice,
            address: selectedAddress,
            paymentMethod,
            invoiceDate: new Date(),
            status,
            couponApplied,
            couponId,
            transactionId: razorpay_payment_id || null,
            paymentStatus
        });

        // Post-order actions for successful orders
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
                                amount: totalPrice,
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

        // Clear the cart
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

const getOrders = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;


        const orderData = await Order.find({ userId: userId })
            .populate("orderedItems.productId", "productName productImage size color")
            .sort({ createdAt: -1 })
            .skip(skip) 
            .limit(limit); 

        if (!orderData) {
            console.error("Error while fetching order list");
            return res.status(404).json({ success: false, message: "Failed to find Orders" });
        }
        const totalOrders = await Order.countDocuments({ userId: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        return res.render("Orders", {
            user: userData,
            order: orderData,
            currentPage: page,
            totalPages: totalPages,
        });
    } catch (error) {
        console.error("Error while rendering Orders page", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const orderId = req.query.id;

        const orderData = await Order.findOne({ orderId: orderId })
            .populate("orderedItems.productId", "productName productImage")
            .exec();

        if (!orderData) {
         
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const addressDoc = await Address.findOne({ userId: orderData.userId });
        let selectedAddress = null;

        if (addressDoc && addressDoc.address.length > 0) {
            selectedAddress = addressDoc.address.find((addr) =>
                addr._id.equals(orderData.address)
            );
        }

        const products = orderData.orderedItems.map(item => ({
            productId: item.productId?._id || null, 
            productImage: item.productId?.productImage || ['default-image.jpg'], 
            productName: item.productId?.productName || item.productName || 'Unknown Product',
            price: item.price || item.regularPrice || 0, 
            quantity: item.quantity || 1,
            total: (item.price || item.regularPrice || 0) * (item.quantity || 1),
            status: item.status || orderData.status 
        }));

        return res.render("orderDetail", {
            user: userData,
            order: orderData,
            address: selectedAddress,
            products: products
        });

    } catch (error) {
        console.error("Error while rendering order details:", error);
        return res.status(500).json({ success: false, message: "Internal server issue" });
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

 
            order.orderedItems.forEach(item => {
                if (item.status === "Payment Failed" || item.status === "Pending") {
                    item.status = "Confirmed"; 
                }
            });

          
            await order.save();
            for (let item of order.orderedItems) {
                if (item.status === "Confirmed") { 
                    await Product.updateOne(
                        { _id: item.productId },
                        { $inc: { quantity: -item.quantity } }
                    );
                }
            }

            return res.status(200).json({
                success: true,
                message: "Payment completed successfully"
            });
        } else {

            order.paymentStatus = "Failed";
            order.status = "Payment Failed";
            
      
            order.orderedItems.forEach(item => {
                if (item.status !== "Cancelled") { 
                    item.status = "Payment Failed";
                }
            });

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
        const orderId=req.query.id;
        const orderData = await Order.findOne({orderId: orderId});
        if(!orderData){
            return res.status(404).json({success:false,message:"Order not found!"});
        }

        return res.render("successPage",{
            user:userData,
            order:orderData,

        });
        
        
    } catch (error) {
        console.error("Error while rendering Sucess page",error);
        res.status(500).json({success:false,message:"Internal Server Issue"});
    }
};
const failedPage=async(req,res)=>{
    try {
        
        const userId=req.session.user;
        const userData=await User.findById(userId);
        const orderId=req.query.id;
        
        const orderData=await Order.findOne({orderId:orderId});
        if(!orderData){
            return res.status(404).json({success:false,message:"order not found!"});
        }
        return res.render("failedPage",{
            user:userData,
            order:orderData,
        });
    } catch (error) {
        console.error("Failed page Error".error);
        return res.status(500).json({success:false,message:"Internal Server Error"});
        
    }
};

const invoiceDawnload = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId }).populate("orderedItems.productId");

        if (!order || (order.status !== "Delivered" && order.status !== "Return Rejected")) {
            return res.status(403).send("Invoice access restricted");
        }

        const missingProducts = order.orderedItems.some(item => !item.productId);
        if (missingProducts) {
            console.warn(`Order ${orderId} has missing product references`);
        }

        const invoiceDir = path.join(__dirname, "../public/invoices");
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

        const totalAmount = order.totalPrice + order.couponDiscount + order.productDiscount;
        const refundedAmount = order.orderedItems.reduce((sum, item) => {
            if (item.status === "Cancelled" || item.status === "Returned") {
                return sum + (item.price * item.quantity);
            }
            return sum;
        }, 0);

        const pdfPath = path.join(invoiceDir, `invoice-${orderId}.pdf`);

        const invoiceHTML = `
        <html>
        <head>
        <style>
            body { font-family: Arial, sans-serif; }
            .invoice-container { width: 80%; margin: auto; padding: 20px; border: 1px solid #ddd; }
            .header { text-align: center; font-size: 24px; font-weight: bold; }
            .details { margin-top: 20px; }
            .product-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .product-table th, .product-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .cancelled { color: #d9534f; font-weight: bold; }
            .returned { color: #6c757d; font-weight: bold; }
            .refund-note { margin-top: 10px; color: #d9534f; font-style: italic; }
        </style>
        </head>
        <body>
        <div class="invoice-container">
            <div class="header">Invoice - Headshield</div>
            <div class="details">
                <p><strong>Order ID:</strong> ${order.orderId}</p>
                <p><strong>Invoice Date:</strong> ${new Date(order.invoiceDate).toLocaleDateString()}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                <p><strong>Delivery Address:</strong> ${order.address.name}, ${order.address.landMark}, ${order.address.city}, ${order.address.state}, ${order.address.country}, ${order.address.pincode}<br>${order.address.phone}</p>
            </div>
            <table class="product-table">
                <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                    <th>Status</th>
                </tr>
                ${order.orderedItems.map(item => `
                    <tr>
                        <td>${item.productId ? item.productId.productName : 'Product Unavailable'}</td>
                        <td>${item.quantity}</td>
                        <td>₹${item.price}</td>
                        <td>₹${item.quantity * item.price}</td>
                        <td class="${item.status === 'Cancelled' ? 'cancelled' : item.status === 'Returned' ? 'returned' : ''}">${item.status}</td>
                    </tr>
                    ${item.status === 'Cancelled' && item.cancelReason ? `<tr><td colspan="5" class="cancelled">Cancellation Reason: ${item.cancelReason}</td></tr>` : ''}
                    ${item.status === 'Returned' && item.returnReason ? `<tr><td colspan="5" class="returned">Return Reason: ${item.returnReason}</td></tr>` : ''}
                `).join('')}
            </table>
            <p><strong>Total Price:</strong> ₹${totalAmount}</p>
            <p><strong>Coupon Discount:</strong> ₹${order.couponDiscount}</p>
            <p><strong>Product Offer:</strong> ₹${order.productDiscount}</p>
            <p><strong>Final Amount:</strong> ₹${order.finalAmount}</p>
            ${refundedAmount > 0 ? `<p class="refund-note"><strong>Refunded Amount:</strong> ₹${refundedAmount} (for cancelled/returned items)</p>` : ''}
        </div>
        </body>
        </html>
        `;

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setContent(invoiceHTML);
            await page.pdf({ path: pdfPath, format: "A4" });
        } catch (err) {
            console.error("Puppeteer error:", err);
            throw err;
        } finally {
            if (browser) {
                await browser.close();
            }
        }

        res.download(pdfPath, `invoice-${orderId}.pdf`, (err) => {
            if (err) {
                console.error("Error sending PDF:", err);
                return res.status(500).send("Error downloading PDF");
            }
            
            try {
                setTimeout(() => {
                    if (fs.existsSync(pdfPath)) {
                        fs.unlinkSync(pdfPath);
                    }
                }, 5000);
            } catch (deleteErr) {
                console.error("Error deleting temporary PDF:", deleteErr);
            }
        });

    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).send("Error generating invoice");
    }
};
const cancelSingleProduct = async (req, res) => {
    const { orderId, productId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;

    try {
  
        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found!" });
        }

  
        const productIndex = order.orderedItems.findIndex(
            (item) => item.productId.toString() === productId
        );
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: "Product not found in this order!" });
        }

        const productItem = order.orderedItems[productIndex];
        
        if (productItem.status === "Cancelled") {
            return res.status(400).json({ success: false, message: "This product is already cancelled!" });
        }


        const itemTotalPrice = productItem.regularPrice * productItem.quantity; 
        const itemDiscount = (productItem.regularPrice - productItem.price) * productItem.quantity; 
        const refundAmount = productItem.price * productItem.quantity; 


        order.orderedItems[productIndex].status = "Cancelled";
        order.orderedItems[productIndex].cancelReason = reason;

        order.totalPrice -= itemTotalPrice; 
        order.productDiscount -= itemDiscount; 
        order.finalAmount -= refundAmount; 


        if (order.totalPrice < 0) order.totalPrice = 0;
        if (order.productDiscount < 0) order.productDiscount = 0;
        if (order.finalAmount < 0) order.finalAmount = 0;

        await Product.updateOne(
            { _id: productItem.productId },
            { $inc: { quantity: productItem.quantity } }
        );


        if (order.paymentMethod === "razorpay" || order.paymentMethod === "wallet") {
            const wallet = await Wallet.findOneAndUpdate(
                { userId: userId },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            transactionType: "credit",
                            amount: refundAmount,
                            description: `Refund for product in Order #${order.orderId}`,
                            createdAt: new Date(),
                            status: "Completed",
                            orderId: order.orderId,
                        },
                    },
                },
                { new: true }
            );

            if (!wallet) {
                await Wallet.create({
                    userId: userId,
                    balance: refundAmount,
                    transactions: [
                        {
                            transactionType: "credit",
                            amount: refundAmount,
                            description: `Refund for product in Order #${order.orderId}`,
                            createdAt: new Date(),
                            status: "Completed",
                            orderId: order.orderId,
                        },
                    ],
                });
            }
        }

        const allCancelled = order.orderedItems.every(item => item.status === "Cancelled");
        if (allCancelled) {
            order.status = "Cancelled";
            order.totalPrice = 0;
            order.productDiscount = 0;
            order.finalAmount = 0; 
        }


        await order.save();

        return res.status(200).json({
            success: true,
            message: "Product cancelled and refund processed successfully.",
        });
    } catch (error) {
        console.error("Error canceling single product", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

  const returnSingleProduct = async (req, res) => {
    const { orderId, productId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user;
  
    try {
      const order = await Order.findOne({ orderId: orderId });
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found!" });
      }
  
      const productIndex = order.orderedItems.findIndex(
        (item) => item.productId.toString() === productId
      );
  
      if (productIndex === -1) {
        return res.status(404).json({ success: false, message: "Product not found in this order!" });
      }
  
      const productItem = order.orderedItems[productIndex];
      
      if (productItem.status === "Cancelled" || productItem.status === "Return Request" || productItem.status === "Returned") {
        return res.status(400).json({ success: false, message: `This product is already ${productItem.status}!` });
      }
  
      order.orderedItems[productIndex].status = "Return Request";
      order.orderedItems[productIndex].returnReason = reason;
      order.orderedItems[productIndex].returnRequestedAt = new Date();

      const allReturnRequested = order.orderedItems.every(item => 
        item.status === "Return Request" || item.status === "Returned" || item.status === "Cancelled"
      );
      
      if (allReturnRequested) {
        order.status = "Return Request";
      }
  
      await order.save();
  
      return res.status(200).json({
        success: true,
        message: "Return request for product submitted successfully.",
      });
    } catch (error) {
      console.error("Error processing return request for single product", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
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
    failedPage,
    invoiceDawnload,
    cancelSingleProduct,
    returnSingleProduct

};
