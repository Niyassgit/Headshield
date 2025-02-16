const express=require("express");
const passport =require("passport");
const router=express.Router();
const userController=require("../controllers/user/userController")
const {userAuth,isBlocked, adminAuth}=require("../middlewares/auth");
const productController=require("../controllers/user/productController");
const profileController =require("../controllers/user/profileController");
const cartController=require("../controllers/user/cartController");
const checkoutController=require("../controllers/user/checkoutController");
const orderController =require("../controllers/user/orderController");
const wishlistController=require("../controllers/user/wishlistController");

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
router.post("/update-profile",userAuth,profileController.editProfile);
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
router.delete("/cart/deleteItem",userAuth,cartController.deleteItem);
router.post('/cart/updateQuantity', cartController.updateQuantity);
//checkout page
router.get("/checkoutPage",userAuth,checkoutController.getcheckoutPage);
router.post("/addNewAddress",userAuth,checkoutController.postAddAddress);
router.post("/checkoutPage/editAddress",userAuth,checkoutController.postEditAddress);
//place order
router.post("/placeOrder",userAuth,orderController.placeOrder);
router.get("/orders",userAuth,orderController.getOrders);
router.get("/order-details/",userAuth,orderController.getOrderDetails);
router.patch("/cancel-order/:id",userAuth,orderController.cancelOrder);
router.patch("/return-order/:id",userAuth,orderController.returnOrder);
//wishlist management
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get("/getWishlist",userAuth,wishlistController.getWishlist);
router.delete("/getWishlist/removeItem/:productId",userAuth,wishlistController.removeItem);




module.exports=router;