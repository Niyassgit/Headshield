const User=require("../../models/userSchema");

const getCouponPage=async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        return res.render("couponPage",{
            user:userData,
        })
    } catch (error) {
        console.error("Error while loading coupon page",error);
        return res.status(500).json({message:false,message:"Internal Server Error"});
        
    }
};


module.exports={
    getCouponPage,
}