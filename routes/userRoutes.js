const express=require("express");
const passport =require("passport");
const router=express.Router();
const userController=require("../controllers/user/userController")



router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage);

//Authentication Routes
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);


router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/');
});

router.get("/login",userController.loadLogin);
router.post("/login",userController.login);


module.exports=router;