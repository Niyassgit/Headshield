const User=require("../../models/userSchema");
const Coupon=require("../../models/couponSchema");

const getCouponPage=async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        const coupons=await Coupon.find();
        const couponsAvailable = coupons.length > 0;


        return res.render("couponPage", {
            user: userData,
            couponsAvailable, 
            coupons: couponsAvailable ? coupons : [],  
        });
    } catch (error) {
        console.error("Error while loading coupon page",error);
        return res.status(500).json({message:false,message:"Internal Server Error"});
        
    }
};
const addCoupon = async(req,res)=>{
    try {
        const {couponName,couponCode,discountType,discountValue,maxDiscountAmount,minPurchaseAmount,startDate,endDate,usageLimit}=req.body;
        const userId=req.session.user;

        // Check for duplicate coupon code instead of user
        const existingCoupon = await Coupon.findOne({ couponCode: couponCode });

        if(existingCoupon){
            return res.status(400).json({
                success: false,
                message: "A coupon with this code already exists"
            });
        }

        const newCoupon = await Coupon.create({
            name: couponName,
            couponCode: couponCode,
            createdOn: startDate,
            expiredOn: endDate,
            offerPrice: discountValue,
            minimumPrice: minPurchaseAmount,
            type: discountType,
            maximumPrice: maxDiscountAmount || null, 
            usageLimit: usageLimit,
            userId: userId ? [userId] : [],
            isActive: true 
        });

        return res.status(200).json({
            success: true,
            message: "Coupon added successfully!"
        });
    } catch (error) {
        console.error("Failed to add Coupon:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add coupon. Please try again."
        });
    }
};
const editCoupon=async (req,res)=>{
    try {

        const {couponId,couponName,couponCode,discountType,offerPrice,minimumPrice,maximumPrice,startDate,endDate,usageLimit}=req.body;
        console.log(req.body);
        await Coupon.findByIdAndUpdate(couponId, {
            name: couponName,
            couponCode: couponCode,
            createdOn: startDate,
            expiredOn: endDate,
            offerPrice: offerPrice,
            minimumPrice: minimumPrice,
            type: discountType,
            maximumPrice: maximumPrice || null, 
            usageLimit: usageLimit,
            isActive: true 
        });

        res.json({ success: true, message: "Coupon updated successfully!" });
    } catch (error) {
        console.error("Error while editing coupon",error);
       return res.json({ success: false, message:"Internal Server Error"});
    }
        
}


module.exports={
    getCouponPage,
    addCoupon,
    editCoupon,
}