const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productContoller");
const orderController = require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponController");
const salesReportController = require("../controllers/admin/salesReportController")
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });

router.get("/admin-error", adminController.pageError);
//login management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/dashboard-data",adminAuth,adminController.loadDashboardData);
router.get("/logout", adminController.logout);
//customer management
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unBlockCustomer", adminAuth, customerController.customerUnBlocked);
//CategoryManagement
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer);
router.post("/cancelCategoryOffer", adminAuth, categoryController.cancelCategoryOffer);

//Brand Controller
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("brandImage"), brandController.addBrand);
router.get("/blockBrand", adminAuth, brandController.blockBrand);
router.get("/unBlockBrand", adminAuth, brandController.unBlockBrand);
router.get("/deleteBrand", adminAuth, brandController.deleteBrand);
//Product Management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, uploads.array("images", 5), productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.get("/blockProduct", adminAuth, productController.productBlock);
router.get("/unBlockProduct", adminAuth, productController.unBlockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.array("images", 5), productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);
router.post("/addProductOffer", adminAuth, productController.addOffer);
router.post("/cancelProductOffer", adminAuth, productController.removeOffer);

//orders management
router.get("/orders", adminAuth, orderController.getOrderslist);
router.get("/order-details", adminAuth, orderController.getOrderDetails);
router.put("/update-order-status/:orderId", adminAuth, orderController.updateStatus);
router.put("/cancelOrder", adminAuth, orderController.cancelOrder);
//coupon management
router.get("/coupons", adminAuth, couponController.getCouponPage);
router.post("/addCoupon", adminAuth, couponController.addCoupon);
router.put("/getCoupon/editCoupon", adminAuth, couponController.editCoupon);
router.delete("/getCoupon/cancelCoupon/:couponId", adminAuth, couponController.removeCoupon);
//sales report management
router.get('/sales-report', adminAuth, salesReportController.getSalesReport);
router.get('/salesReportPDF/pdf', adminAuth, salesReportController.getSalesReportPDF);
router.get('/sales-report/excel', adminAuth, salesReportController.getSalesReportExcel);

router.use((req, res) => {
    res.redirect("/admin/admin-error");
  });


module.exports = router;

