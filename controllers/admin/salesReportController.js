const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const moment = require("moment");

const getSalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const { filterBy, fromDate, toDate } = req.query;

    let filter = { status: { $in: ["Delivered", "Return Rejected"] } };

    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)),
      };
    } else {
      const today = new Date();
      if (filterBy === "daily") {
        filter.createdAt = {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lte: new Date(),
        };
      } else if (filterBy === "weekly") {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        filter.createdAt = {
          $gte: lastWeek,
          $lte: new Date(),
        };
      } else if (filterBy === "monthly") {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        filter.createdAt = {
          $gte: lastMonth,
          $lte: new Date(),
        };
      } else if (filterBy === "yearly") {
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        filter.createdAt = {
          $gte: lastYear,
          $lte: new Date(),
        };
      }
    }

    const totalOrders = await Order.countDocuments(filter);
    const totals = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$finalAmount" },
          totalCouponDiscount: { $sum: "$couponDiscount" },
          totalProductDiscount: { $sum: "$productDiscount" },
        },
      },
    ]);

    const totalRevenue = totals.length > 0 ? totals[0].totalRevenue : 0;
    const totalCouponDiscount = totals.length > 0 ? totals[0].totalCouponDiscount : 0;
    const totalProductDiscount = totals.length > 0 ? totals[0].totalProductDiscount : 0;
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(filter)
      .populate("userId", "name email phone")
      .populate("orderedItems.productId", "productName salePrice")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render("salesReport", {
      orders,
      totalRevenue,
      totalCouponDiscount,
      totalProductDiscount,
      totalOrders,
      currentPage: page,
      totalPages,
      filterBy,
      fromDate,
      toDate,
    });
  } catch (error) {
    console.log("Error getting sales report", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const getSalesReportPDF = async (req, res) => {
  try {
    const { filterBy, fromDate, toDate } = req.query;
    let filter = { status: { $in: ["Delivered", "Return Rejected"] } };

    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)),
      };
    } else {
      const today = new Date();
      if (filterBy === "daily") {
        filter.createdAt = {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lte: new Date(),
        };
      } else if (filterBy === "weekly") {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        filter.createdAt = {
          $gte: lastWeek,
          $lte: new Date(),
        };
      } else if (filterBy === "monthly") {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        filter.createdAt = {
          $gte: lastMonth,
          $lte: new Date(),
        };
      } else if (filterBy === "yearly") {
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        filter.createdAt = {
          $gte: lastYear,
          $lte: new Date(),
        };
      }
    }

    const orders = await Order.find(filter)
      .populate("userId", "name email phone")
      .populate("orderedItems.productId", "productName salePrice")
      .sort({ createdAt: -1 });

    const totals = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$finalAmount" },
          totalCouponDiscount: { $sum: "$couponDiscount" },
          totalProductDiscount: { $sum: "$productDiscount" },
        },
      },
    ]);

    const totalRevenue = totals.length > 0 ? totals[0].totalRevenue : 0;
    const totalCouponDiscount = totals.length > 0 ? totals[0].totalCouponDiscount : 0;
    const totalProductDiscount = totals.length > 0 ? totals[0].totalProductDiscount : 0;
    const totalOrders = orders.length;

    const salesReportDir = path.join(__dirname, "../../public/salesReport");
    if (!fs.existsSync(salesReportDir)) {
      fs.mkdirSync(salesReportDir, { recursive: true });
    }

    const filePath = path.join(salesReportDir, "sales_report.pdf");
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(24).font("Helvetica-Bold").text("Headshield", { align: "center" }).moveDown(0.5);
    doc.fontSize(16).font("Helvetica").text("Sales Report", { align: "center" }).moveDown(0.5);
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString("en-US")}`, { align: "center" }).moveDown(1);

    // Summary Box
    doc.rect(50, doc.y, 500, 100).stroke();
    doc.fontSize(12).text("Summary", 60, doc.y + 10).fontSize(10)
      .text(`Total Orders: ${totalOrders}`, 60, doc.y + 5)
      .text(`Total Sales: Rs.${totalRevenue.toLocaleString()}.00`, 60, doc.y + 5)
      .text(`Total Coupon Discount: Rs.${totalCouponDiscount.toLocaleString()}.00`, 60, doc.y + 5)
      .text(`Total Product Discount: Rs.${totalProductDiscount.toLocaleString()}.00`, 60, doc.y + 5)
      .moveDown(2);

    // Table Headers
    doc.fontSize(12).text("Order Details", { align: "center" }).moveDown(0.5);

    const tableTop = doc.y;
    const columnSpacing = 20;
    const columns = {
      orderId: { x: 50, width: 180 },  // Increased width from 120 to 180
      customer: { x: 250, width: 120 }, // Adjusted x position due to orderId width change
      amount: { x: 390, width: 80 },    // Adjusted x position and slightly reduced width
      date: { x: 490, width: 60 }       // Adjusted x position and slightly reduced width
    };

    // Draw table header
    doc.fillColor("#4CAF50")
      .rect(50, tableTop, 500, 20)
      .fill();

    doc.fillColor("white")
      .fontSize(10);

    Object.entries(columns).forEach(([key, column]) => {
      const header = key.charAt(0).toUpperCase() + key.slice(1);
      doc.text(header, column.x + columnSpacing/2, tableTop + 5, {
        width: column.width,
        align: key === 'amount' ? 'right' : 'left'
      });
    });

    // Draw table rows
    let rowTop = tableTop + 25;
    const rowHeight = 20;

    orders.forEach((order, i) => {
      // Alternate row background
      if (i % 2 === 0) {
        doc.fillColor("#f5f5f5")
          .rect(50, rowTop, 500, rowHeight)
          .fill();
      }

      doc.fillColor("black")
        .text(order._id.toString(), columns.orderId.x + columnSpacing/2, rowTop + 5, {
          width: columns.orderId.width,
          align: 'left'
        })
        .text(order.userId.name, columns.customer.x + columnSpacing/2, rowTop + 5, {
          width: columns.customer.width,
          align: 'left'
        })
        .text(`Rs.${order.finalAmount.toLocaleString()}.00`, columns.amount.x + columnSpacing/2, rowTop + 5, {
          width: columns.amount.width,
          align: 'right'
        })
        .text(moment(order.createdAt).format("DD/MM/YYYY"), columns.date.x + columnSpacing/2, rowTop + 5, {
          width: columns.date.width,
          align: 'left'
        });

      rowTop += rowHeight;

      // Add a new page if we're near the bottom
      if (rowTop > doc.page.height - 50) {
        doc.addPage();
        rowTop = 50;
      }
    });

    // Draw table border
    doc.rect(50, tableTop, 500, rowTop - tableTop).stroke();

    // Draw vertical lines for columns
    Object.values(columns).forEach(column => {
      doc.moveTo(column.x, tableTop)
         .lineTo(column.x, rowTop)
         .stroke();
    });

    doc.end();

    stream.on("finish", () => {
      res.download(filePath, "Headshield_sales_report.pdf", (err) => {
        if (err) {
          console.error("Error downloading PDF:", err);
          res.status(500).send("Error downloading PDF");
        }
        fs.unlinkSync(filePath);
      });
    });
  } catch (error) {
    console.log("Error generating sales report PDF", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
module.exports = {
  getSalesReport,
  getSalesReportPDF,
};
