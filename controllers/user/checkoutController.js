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
module.exports={
    getcheckoutPage,
    postAddAddress,
    postEditAddress,

}