const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { ProfilingLevel } = require("mongodb");
const Order=require("../../models/orderSchema");
const Product=require("../../models/productSchema");



const pageError = async (req, res) => {

    res.render("admin-error");
}


const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin");
    }
    const errorMessage = req.session.adminLoginError
    req.session.adminLoginError = null;
    return res.render('admin-login', {
        message: errorMessage
    })
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect("/admin");
            } else {
                req.session.adminLoginError = "Incorrect Password"
                return res.redirect('/admin/login')
            }
        } else {
            req.session.adminLoginError = "Not an Admin"
            return res.redirect("/admin/login");
        }
    } catch (error) {
        console.error("Login error", error);
        return res.redirect("/pageerror");
    }
};

const logout = async (req, res) => {

    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroy session", err);
                return res.redirect("/admin-error");
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout", error);
        res.redirect("/pageerror")
    }
};

const loadDashboard = async (req, res) => {
    try {
        const { filterType = "weekly" } = req.query; 
        let dateFilter = {};

        const now = new Date();
        if (filterType === "weekly") {
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            dateFilter = { createdAt: { $gte: startOfWeek } };
        } else if (filterType === "monthly") {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { createdAt: { $gte: startOfMonth } };
        } else if (filterType === "yearly") {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            dateFilter = { createdAt: { $gte: startOfYear } };
        }

        const totalRevenue = await Order.aggregate([
            { 
                $match: { 
                    ...dateFilter, 
                    status: { $in: ["Delivered", "Return Rejected"] } 
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$finalAmount" } 
                } 
            }
        ]);
        

        const totalOrders = await Order.countDocuments({ 
            ...dateFilter, 
            status: { $in: ["Delivered", "Return Rejected"] } 
        });
        
        const totalUsers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();

        const categoryPerformance = await Order.aggregate([
            { $match: dateFilter },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.productId",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails",
                },
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$categoryDetails.name",
                    totalSales: { $sum: "$orderedItems.quantity" },
                    revenue: { $sum: "$orderedItems.price" }
                },
            },
            { $sort: { revenue: -1 } }
        ]);

        const bestSellingProducts = await Order.aggregate([
            
            {
                $match: {
                    status: { $in: ["Delivered", "Return Rejected"] },
                    ...dateFilter
                }
            },
            { $unwind: "$orderedItems" }, 
            {
                $group: {
                    _id: "$orderedItems.productId",
                    totalSales: { $sum: "$orderedItems.quantity" }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 5 }, 
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" }, 
            {
                $lookup: {
                    from: "categories", 
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $project: {
                    _id: "$productDetails._id",
                    productName: "$productDetails.productName",
                    category: "$categoryDetails.name", 
                    price: "$productDetails.regularPrice",
                    totalSales: 1
                }
            }
        ]);
        
   

        const bestBrands = await Order.aggregate([
          
            {
                $match: {
                    status: { $in: ["Delivered", "Return Rejected"] },
                    ...dateFilter
                }
            },
            { $unwind: "$orderedItems" },
          
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" }, 
            
            {
                $group: {
                    _id: "$productDetails.brand",
                    totalSales: { $sum: "$orderedItems.quantity" }
                }
            },
            { $sort: { totalSales: -1 } }, 
            { $limit: 1 } 
        ]);
        

        const bestCategory = await Order.aggregate([
       
            {
                $match: {
                    status: { $in: ["Delivered", "Return Rejected"] },
                    ...dateFilter 
                }
            },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" }, 
            {
                $group: {
                    _id: "$productDetails.category",
                    totalSales: { $sum: "$orderedItems.quantity" }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 1 }, 
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" }, 
            {
                $project: {
                    _id: "$categoryDetails._id",
                    categoryName: "$categoryDetails.name", 
                    totalSales: 1
                }
            }
        ]);
        

        const recentOrders = await Order.find({ ...dateFilter, status: { $in: ["Delivered", "Return Rejected"] } })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate("userId", "name")
            .populate("orderedItems.productId", "productName")
            .lean();

        res.render("dashboard", {
            revenue: totalRevenue[0]?.total || 0,
            orders: totalOrders,
            users: totalUsers,
            products: totalProducts,
            categoryPerformance,
            bestSellingProducts,
            bestBrand: bestBrands[0]?._id || "N/A",
            bestBrandSales: bestBrands[0]?.totalSales || 0,
            bestCategory: bestCategory[0]?.categoryName || "N/A",
            bestCategorySales: bestCategory[0]?.totalSales || 0,
            recentOrders,
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        return res.render('admin-error', { message: "Dashboard page error" });
    }
};
const loadDashboardData = async (req, res) => {
    try {
        const { filter } = req.query;
        let dateFilter = {};
        let matchStage = {}; // Define matchStage

        const now = new Date();
        if (filter === "weekly") {
            dateFilter.createdAt = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
        } else if (filter === "monthly") {
            dateFilter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
        } else if (filter === "yearly") {
            dateFilter.createdAt = { $gte: new Date(now.getFullYear(), 0, 1) };
        }

        // Set matchStage to include date filter and status
        matchStage = { 
            ...dateFilter, 
            status: { $in: ["Delivered", "Return Rejected"] } 
        };

        // Fetch revenue data
        const revenueOverTime = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalRevenue: { $sum: "$finalAmount" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Fetch orders data
        const ordersOverTime = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalOrders: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);    

        // Get total users and products
        const totalUsers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();

        // Get total numbers for summary cards
        const totalData = await Order.aggregate([
            { $match: matchStage },
            { 
                $group: { 
                    _id: null, 
                    totalRevenue: { $sum: "$finalAmount" },
                    totalOrders: { $sum: 1 }
                } 
            }
        ]);

        // Category Performance
        const categoryPerformance = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.productId",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails",
                },
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$categoryDetails.name",
                    totalSales: { $sum: "$orderedItems.quantity" },
                    revenue: { $sum: "$orderedItems.price" }
                },
            },
            { $sort: { revenue: -1 } }
        ]);

        // Best Selling Products
        const bestSellingProducts = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$orderedItems" },
            {
                $group: {
                    _id: "$orderedItems.productId",
                    totalSales: { $sum: "$orderedItems.quantity" }
                },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                },
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "categories", 
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $project: {
                    _id: "$productDetails._id",
                    productName: "$productDetails.productName",
                    category: "$categoryDetails.name", 
                    price: "$productDetails.regularPrice",
                    totalSales: 1
                }
            }
        ]);

        // Best Brand
        const bestBrands = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" }, 
            {
                $group: {
                    _id: "$productDetails.brand",
                    totalSales: { $sum: "$orderedItems.quantity" }
                }
            },
            { $sort: { totalSales: -1 } }, 
            { $limit: 1 }
        ]);

        // Best Category
        const bestCategory = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.productId",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$productDetails.category",
                    totalSales: { $sum: "$orderedItems.quantity" },
                },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 1 },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "categoryDetails",
                },
            },
            { $unwind: "$categoryDetails" },
            {
                $project: {
                    _id: "$categoryDetails._id",
                    categoryName: "$categoryDetails.name",
                    totalSales: 1,
                },
            },
        ]);

        // Recent Orders
        const recentOrders = await Order.find({ status: { $in: ["Delivered", "Return Rejected"] }})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate("userId", "name")
            .populate("orderedItems.productId", "productName")
            .lean();

        // Prepare and send the response
        res.json({
            revenue: revenueOverTime.map(r => r.totalRevenue),
            revenueLabels: revenueOverTime.map(r => r._id),
            orders: ordersOverTime.map(o => o.totalOrders),
            ordersLabels: ordersOverTime.map(o => o._id),
            totalRevenue: totalData[0]?.totalRevenue || 0,
            totalOrders: totalData[0]?.totalOrders || 0,
            users: totalUsers,
            products: totalProducts,
            categoryPerformance,
            bestSellingProducts,
            bestBrand: bestBrands[0]?._id || "N/A",
            bestBrandSales: bestBrands[0]?.totalSales || 0,
            bestCategory: bestCategory[0]?.categoryName || "N/A",
            bestCategorySales: bestCategory[0]?.totalSales || 0,
            recentOrders,
        });

    } catch (error) {
        console.error("Dashboard Data Error:", error);
        res.status(500).json({ message: "Error fetching dashboard data", error: error.message });
    }
};


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    loadDashboardData

};