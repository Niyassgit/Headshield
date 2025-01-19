const express=require("express");
const router=express.Router();
const adminController=require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController")
const {userAuth,adminAuth}=require("../middlewares/auth");


router.get("/pageerror",adminController.pageError);
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminController.loadDashboard);
router.get("/logout",adminController.logout);

router.get("/users",adminAuth,customerController.customerInfo);

module.exports=router;
//private router