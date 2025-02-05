const User=require("../../models/userSchema");


const viewCartPage= async(req,res)=>{
   
    try {
        const userId=req.session.user;
        const userData= await User.findById(userId);
        return res.render("cartPage",{
         user:userData,
        });
        
    } catch (error) {
        console.error("error while rendering cart page",error);
        res.redirect("/pageNotFound");
    }
};

module.exports={

    viewCartPage,
}