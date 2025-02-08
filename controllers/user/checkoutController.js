const User=require("../../models/userSchema");
const Address=require("../../models/addressSchema");
const Cart=require("../../models/cartSchema");
const mongoose=require("mongoose");

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
        if (cartData) {
            cartList = cartData.items;  
        }

        res.render("checkoutPage", {
            user: userData,
            address: addressList,
            cart: cartList,
            cartTotal: cartData ? cartData.cartTotal : 0,  
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
};
module.exports={
    getcheckoutPage,
    postAddAddress
}