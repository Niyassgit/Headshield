const User=require("../../models/userSchema");
const Address=require("../../models/addressSchema");
const Cart=require("../../models/cartSchema");
const mongoose=require("mongoose");


const getcheckoutPage=async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        if(!userData){
            return res.status(400).json({success:false,message:"User not found"});
        }
        const addressDocs = await Address.find({ userId: userData._id });
        let addressList = [];
        addressDocs.forEach((doc) => {
            addressList = addressList.concat(doc.address);
        });


        res.render("checkoutPage",{
            user:userData,
            address:addressList
        });
        
    } catch (error) {
        console.error("Error fetching checkout page",error);
        res.status(500).json({success:false,message:"Internal Server Error"});
        
    }
}

module.exports={
    getcheckoutPage
}