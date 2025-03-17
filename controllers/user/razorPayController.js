const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });



  const createOrder = async (req, res) => {
    try {
        const { amount, currency, discountAmount } = req.body; 
        
        const options = {
            amount: amount * 100, 
            currency: currency || 'INR',
            receipt: `order_rcptid_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        res.json({ success: true, order, discountAmount }); 
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


 
  
  module.exports={
    createOrder,
  }

