const User=require("../../models/userSchema");
const Address=require("../../models/addressSchema");
const Cart=require("../../models/cartSchema");
const Coupon=require("../../models/couponSchema");
const Wallet=require("../../models/walletSchema");
const mongoose=require("mongoose");
const { ConnectionClosedEvent } = require("mongodb");





const getcheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        const addressDocs = await Address.find({ userId: userData._id });
        let addressList = [];
        addressDocs.forEach((doc) => {
            addressList = addressList.concat(doc.address);
        });

        const cartData = await Cart.findOne({ userId: userData._id }).populate("items.productId");

        let cartList = [];
        let cartTotal = 0;

        if (cartData) {
            cartList = cartData.items;  
            cartTotal = cartData.cartTotal; 
        }
   
        const currentDate = new Date();
  
    
       
        let coupons = await Coupon.find({
            isActive: true, 
            expiredOn: { $gt: currentDate }, 
            minimumPrice: { $lte: cartTotal },
            userId: { $ne: userData._id },
        }).sort({ createdOn: -1 });

     
        const wallet=await Wallet.findOne({userId:userId});

        res.render("checkoutPage", {
            user: userData,
            address: addressList,
            cart: cartList,
            cartTotal: cartTotal,
            coupons: coupons || [], 
            wallet:wallet?wallet:[],
        });

    } catch (error) {
        console.error("Error fetching checkout page", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const postAddAddress= async(req,res)=>{
    try {
        const userId=req.session.user;
        const userData=await User.findOne({_id:userId});
        const {addressType,name,phone,altPhone,landMark,city,state,country,pincode}= req.body

        const userAddress = await Address.findOne({userId:userData._id});

        if(!userAddress){
            const newAddress = new Address({
                userId:userData._id,
                address:[{addressType,name,phone,altPhone,landMark,city,state,country,pincode}]
            });
            await newAddress.save();

        }else{
            userAddress.address.push({addressType,name,phone,altPhone,landMark,city,state,country,pincode});
            await userAddress.save();
        }
        res.redirect("/checkoutPage");
    } catch (error) {
        console.log("Error adding Address:",error);
        res.redirect("/checkoutPage");
    }
};const postEditAddress = async (req, res) => {
    try {
        const { addressId, addressType, name, phone, altPhone, landMark, city, state, country, pincode } = req.body;

        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).json({ 
                success: false, 
                message: "Address not found" 
            });
        }

        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$.addressType": addressType,
                    "address.$.name": name,
                    "address.$.phone": phone,
                    "address.$.altPhone": altPhone,
                    "address.$.landMark": landMark,
                    "address.$.city": city,
                    "address.$.state": state,
                    "address.$.pincode": pincode,
                    "address.$.country": country
                }
            }
        );

        return res.json({
            success: true,
            message: "Address updated successfully"
        });
    } catch (error) {
        console.log("Error updating address:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while updating the address"
        });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, totalAmount } = req.body;

        if (!couponCode || totalAmount === undefined) {
            return res.status(400).json({ success: false, message: "Coupon code and total amount are required" });
        }

        const coupon = await Coupon.findOne({ couponCode });

        if (!coupon) {
            return res.status(404).json({ success: false, message: "Invalid or expired coupon" });
        }

        if (coupon.expiredOn && new Date(coupon.expiredOn) < new Date()) {
            return res.status(400).json({ success: false, message: "Coupon has expired" });
        }

        let discountAmount = 0;

        if (coupon.type === "percentage") {
            discountAmount = (totalAmount * coupon.offerPrice) / 100;

            if (discountAmount > coupon.maximumPrice) {
                discountAmount = coupon.maximumPrice;
            }
        } else {
            discountAmount = coupon.offerPrice;
        }

        discountAmount = Math.min(discountAmount, totalAmount);
        
        const finalAmount = totalAmount - discountAmount;

        res.json({
            success: true,
            discount: discountAmount.toFixed(2),  
            cartTotal: finalAmount.toFixed(2), 
            discountAmount:discountAmount,  
            message: `Coupon applied! You saved ₹${discountAmount}.`
        });
    } catch (error) {
        console.error("Error while applying coupon:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


module.exports={
    getcheckoutPage,
    postAddAddress,
    postEditAddress,
    applyCoupon,
}