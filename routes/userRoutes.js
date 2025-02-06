const express=require("express");
const passport =require("passport");
const router=express.Router();
const userController=require("../controllers/user/userController")
const {userAuth,isBlocked}=require("../middlewares/auth");
const productController=require("../controllers/user/productController");
const profileController =require("../controllers/user/profileController");
const cartController=require("../controllers/user/cartController");


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
 
//profile management
router.get("/forgot-password",profileController.forgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);
router.get("/userProfile",userAuth,profileController.userProfile);
router.get("/change-password",userAuth,profileController.changePassword);
router.post("/change-password",userAuth,profileController.changePasswordValid);
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp);
router.get("/reset-password-user",userAuth,profileController.getResetPassPageUser);
router.post("/reset-password-user",userAuth,profileController.postNewPassword);
//adress management
router.get("/getAllAddress",userAuth,profileController.getAllAddress);
router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);
//cart management
router.get("/cart",userAuth,cartController.viewCartPage);
router.post("/addToCart",userAuth,cartController.addToCart);





module.exports=router;