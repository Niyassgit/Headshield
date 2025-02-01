const express=require("express");
const passport =require("passport");
const router=express.Router();
const userController=require("../controllers/user/userController")
const {userAuth,isBlocked}=require("../middlewares/auth");
const productController=require("../controllers/user/productController");


router.get("/pageNotFound",userController.pageNotFound)

//public Routes
router.get("/",isBlocked,userController.loadHomepage);
router.get("/shop",userController.loadShoppingPage);
router.get("/productDetails",isBlocked,productController.productDetails);

//Authentication Routes
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);


router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user=req.session.passport.user;
    res.redirect('/');
});

router.get("/login",userController.loadLogin);
router.post("/login",userController.login);
router.get("/logout",userController.logout);




module.exports=router;