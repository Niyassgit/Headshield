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

// Load dashboard view
const loadDashboard = async (req, res) => {
    try {
        // Get basic stats for initial page load
        const users = await User.countDocuments({ isAdmin: false });
        const products = await Product.countDocuments();
        const orders = await Order.countDocuments();
        const revenue = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);
        
        // Get best selling products for initial view
        const bestSellingProducts = await Order.aggregate([
            { $unwind: "$orderedItems" },
            { $group: { 
                _id: "$orderedItems.productId", 
                totalSales: { $sum: "$orderedItems.quantity" },
                price: { $first: "$orderedItems.price" }
            }},
            { $sort: { totalSales: -1 } },
            { $limit: 5 },
            { $lookup: { 
                from: "products", 
                localField: "_id", 
                foreignField: "_id", 
                as: "productInfo" 
            }},
            { $unwind: "$productInfo" },
            { $lookup: { 
                from: "categories", 
                localField: "productInfo.category", 
                foreignField: "_id", 
                as: "categoryInfo" 
            }},
            { $unwind: "$categoryInfo" },
            { $project: {
                productName: "$productInfo.productName",
                category: "$categoryInfo.name",
                price: { $round: ["$price", 0] },
                totalSales: 1
            }}
        ]);
        
        // Get best brand and category
        const topCategory = await Order.aggregate([
            { $unwind: "$orderedItems" },
            { $lookup: { 
                from: "products", 
                localField: "orderedItems.productId", 
                foreignField: "_id", 
                as: "product" 
            }},
            { $unwind: "$product" },
            { $lookup: { 
                from: "categories", 
                localField: "product.category", 
                foreignField: "_id", 
                as: "category" 
            }},
            { $unwind: "$category" },
            { $group: { 
                _id: "$category.name", 
                sales: { $sum: "$orderedItems.quantity" } 
            }},
            { $sort: { sales: -1 } },
            { $limit: 1 }
        ]);
        
        const topBrand = await Order.aggregate([
            { $unwind: "$orderedItems" },
            { $lookup: { 
                from: "products", 
                localField: "orderedItems.productId", 
                foreignField: "_id", 
                as: "product" 
            }},
            { $unwind: "$product" },
            { $group: { 
                _id: "$product.brand", 
                sales: { $sum: "$orderedItems.quantity" } 
            }},
            { $sort: { sales: -1 } },
            { $limit: 1 }
        ]);
        
        // Get recent orders
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("userId", "name")
            .populate({
                path: "orderedItems.productId",
                select: "productName"
            });
        
        res.render('dashboard', {
            users,
            products,
            orders,
            revenue: revenue[0]?.total || 0,
            bestSellingProducts,
            bestBrand: topBrand[0]?._id || 'N/A',
            bestBrandSales: topBrand[0]?.sales || 0,
            bestCategory: topCategory[0]?._id || 'N/A',
            bestCategorySales: topCategory[0]?.sales || 0,
            recentOrders
        });
    } catch (error) {
        console.error("Dashboard Render Error:", error);
        res.status(500).render('error', { error: "Could not render dashboard" });
    }
};

// Load dashboard data for AJAX requests (filtered by period)
const loadDashboardData = async (req, res) => {
    try {
        const filter = req.query.filter || "monthly"; // Default to monthly
        
        // Get current date info
        const now = new Date();
        const currentYear = now.getFullYear();
        let periodFilter = {};
        let revenueLabels = [];
        let ordersLabels = [];
        let revenueData = [];
        let ordersData = [];
        
        // Days of the week array (for weekly view)
        const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        
        // Setup time periods and labels
        if (filter === "weekly") {
            // Calculate the start date (previous Monday)
            const lastWeekStart = new Date(now);
            const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust to get Monday (0 for Monday)
            lastWeekStart.setDate(now.getDate() - diff);
            lastWeekStart.setHours(0, 0, 0, 0);
            
            // End date is the current time
            const lastWeekEnd = new Date(now);
            
            periodFilter = {
                createdAt: {
                    $gte: lastWeekStart,
                    $lte: lastWeekEnd
                }
            };
            
            // Set labels for days of the current week
            revenueLabels = [...daysOfWeek];
            ordersLabels = [...daysOfWeek];
            
            // Initialize arrays with zeros for each day
            revenueData = Array(7).fill(0);
            ordersData = Array(7).fill(0);
            
            // Fetch order data grouped by day of the week for the past week
            const weeklyData = await Order.aggregate([
                { $match: { status: "Delivered", ...periodFilter } },
                {
                    $addFields: {
                        // Convert to day of week (1 = Monday, 2 = Tuesday, ..., 7 = Sunday)
                        dayOfWeek: {
                            $let: {
                                vars: {
                                    // MongoDB's $dayOfWeek returns 1 for Sunday, 2 for Monday, etc.
                                    // We convert it so 1 = Monday, ..., 7 = Sunday
                                    dow: { $dayOfWeek: "$createdAt" }
                                },
                                in: { $cond: [{ $eq: ["$$dow", 1] }, 7, { $subtract: ["$$dow", 1] }] }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: "$dayOfWeek",
                        revenue: { $sum: "$finalAmount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id": 1 } }
            ]);
            
            // Map the aggregation results to the arrays
            weeklyData.forEach(item => {
                const dayIndex = item._id - 1; // Convert 1-based to 0-based index
                revenueData[dayIndex] = item.revenue;
                ordersData[dayIndex] = item.count;
            });
            
        } else if (filter === "monthly") {
            // For monthly view (grouped by weeks in the current month)
            const startOfMonth = new Date(currentYear, now.getMonth(), 1);
            const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0);
            
            periodFilter = {
                createdAt: {
                    $gte: startOfMonth,
                    $lte: endOfMonth
                }
            };
            
            // Divide the month into weeks
            const totalDays = endOfMonth.getDate();
            const numWeeks = Math.ceil(totalDays / 7);
            
            revenueLabels = [];
            for (let i = 0; i < numWeeks; i++) {
                const weekStart = i * 7 + 1;
                const weekEnd = Math.min((i + 1) * 7, totalDays);
                revenueLabels.push(`Week ${i + 1} (${weekStart}-${weekEnd})`);
            }
            ordersLabels = [...revenueLabels];
            
            // Monthly data (by weeks in current month)
            const monthlyData = await Order.aggregate([
                { $match: { status: "Delivered", ...periodFilter } },
                {
                    $project: {
                        week: {
                            $ceil: {
                                $divide: [
                                    { $dayOfMonth: "$createdAt" },
                                    7
                                ]
                            }
                        },
                        finalAmount: 1
                    }
                },
                {
                    $group: {
                        _id: "$week",
                        revenue: { $sum: "$finalAmount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id": 1 } }
            ]);
            
            // Initialize empty arrays with proper length
            revenueData = Array(numWeeks).fill(0);
            ordersData = Array(numWeeks).fill(0);
            
            // Fill data from query
            monthlyData.forEach(item => {
                const weekIndex = item._id - 1; // Convert to 0-based index
                if (weekIndex >= 0 && weekIndex < numWeeks) {
                    revenueData[weekIndex] = item.revenue;
                    ordersData[weekIndex] = item.count;
                }
            });
            
        } else if (filter === "yearly") {
            // For yearly view (all 12 months of the current year)
            const startOfYear = new Date(currentYear, 0, 1);
            const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
            
            periodFilter = {
                createdAt: {
                    $gte: startOfYear,
                    $lte: endOfYear
                }
            };
            
            revenueLabels = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];
            ordersLabels = [...revenueLabels];
            
            // Yearly data (all months in current year)
            const yearlyData = await Order.aggregate([
                { $match: { status: "Delivered", ...periodFilter } },
                {
                    $group: {
                        _id: { month: { $month: "$createdAt" } },
                        revenue: { $sum: "$finalAmount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.month": 1 } }
            ]);
            
            // Initialize empty arrays
            revenueData = Array(12).fill(0);
            ordersData = Array(12).fill(0);
            
            // Fill data from query
            yearlyData.forEach(item => {
                const monthIndex = item._id.month - 1; // Convert to 0-based index
                revenueData[monthIndex] = item.revenue;
                ordersData[monthIndex] = item.count;
            });
        }
        
        // Apply filter to queries for other aggregations
        const matchStage = { $match: { status: "Delivered", ...periodFilter } };
        
        // Get category performance data
        const categoryPerformance = await Order.aggregate([
            matchStage,
            { $unwind: "$orderedItems" },
            { $lookup: { 
                from: "products", 
                localField: "orderedItems.productId", 
                foreignField: "_id", 
                as: "product" 
            }},
            { $unwind: "$product" },
            { $lookup: { 
                from: "categories", 
                localField: "product.category", 
                foreignField: "_id", 
                as: "category" 
            }},
            { $unwind: "$category" },
            { $group: { 
                _id: "$category.name", 
                revenue: { $sum: "$orderedItems.price" } 
            }},
            { $sort: { revenue: -1 } }
        ]);
        
        // Get best selling products
        const bestSellingProducts = await Order.aggregate([
            matchStage,
            { $unwind: "$orderedItems" },
            { $group: { 
                _id: "$orderedItems.productId", 
                totalSales: { $sum: "$orderedItems.quantity" },
                price: { $first: "$orderedItems.price" }
            }},
            { $sort: { totalSales: -1 } },
            { $limit: 5 },
            { $lookup: { 
                from: "products", 
                localField: "_id", 
                foreignField: "_id", 
                as: "productInfo" 
            }},
            { $unwind: "$productInfo" },
            { $lookup: { 
                from: "categories", 
                localField: "productInfo.category", 
                foreignField: "_id", 
                as: "categoryInfo" 
            }},
            { $unwind: "$categoryInfo" },
            { $project: {
                productName: "$productInfo.productName",
                category: "$categoryInfo.name",
                price: { $round: ["$price", 0] },
                totalSales: 1
            }}
        ]);
        
        // Get summary metrics
        const summary = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $group: { 
                _id: null, 
                totalRevenue: { $sum: "$finalAmount" },
                totalOrders: { $sum: 1 }
            }}
        ]);
        
        // Get top performers
        const topCategory = await Order.aggregate([
            matchStage,
            { $unwind: "$orderedItems" },
            { $lookup: { 
                from: "products", 
                localField: "orderedItems.productId", 
                foreignField: "_id", 
                as: "product" 
            }},
            { $unwind: "$product" },
            { $lookup: { 
                from: "categories", 
                localField: "product.category", 
                foreignField: "_id", 
                as: "category" 
            }},
            { $unwind: "$category" },
            { $group: { 
                _id: "$category.name", 
                sales: { $sum: "$orderedItems.quantity" } 
            }},
            { $sort: { sales: -1 } },
            { $limit: 1 }
        ]);
        
        const topBrand = await Order.aggregate([
            matchStage,
            { $unwind: "$orderedItems" },
            { $lookup: { 
                from: "products", 
                localField: "orderedItems.productId", 
                foreignField: "_id", 
                as: "product" 
            }},
            { $unwind: "$product" },
            { $group: { 
                _id: "$product.brand", 
                sales: { $sum: "$orderedItems.quantity" } 
            }},
            { $sort: { sales: -1 } },
            { $limit: 1 }
        ]);
        
        // Return the dashboard data as JSON
        res.json({
            filter,
            revenueLabels,
            revenue: revenueData,
            ordersLabels,
            orders: ordersData,
            categoryPerformance,
            bestSellingProducts,
            totalRevenue: summary[0]?.totalRevenue?.toLocaleString() || "0",
            totalOrders: summary[0]?.totalOrders || 0,
            bestBrand: topBrand[0]?._id || "N/A",
            bestBrandSales: topBrand[0]?.sales || 0,
            bestCategory: topCategory[0]?._id || "N/A",
            bestCategorySales: topCategory[0]?.sales || 0,
        });
        
    } catch (error) {
        console.error("Dashboard Data Error:", error);
        res.status(500).json({ error: "Error loading dashboard data" });
    }
};
module.exports = {
    loadLogin,
    login,
    pageError,
    logout,
    loadDashboard,
    loadDashboardData

};