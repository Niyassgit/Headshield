const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs")
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
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        const lastSunday = new Date(today);
        lastSunday.setDate(today.getDate() - dayOfWeek); 
        
        filter.createdAt = {
            $gte: lastSunday,  
            $lte: today       
        };
    
      } else if (filterBy === "monthly") {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        filter.createdAt = {
            $gte: firstDayOfMonth, 
            $lte: today         
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


    doc.fontSize(24).font("Helvetica-Bold").text("Headshield", { align: "center" }).moveDown(0.5);
    doc.fontSize(16).font("Helvetica").text("Sales Report", { align: "center" }).moveDown(0.5);
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString("en-US")}`, { align: "center" }).moveDown(1);


    doc.rect(50, doc.y, 500, 100).stroke();
    doc.fontSize(12).text("Summary", 60, doc.y + 10).fontSize(10)
      .text(`Total Orders: ${totalOrders}`, 60, doc.y + 5)
      .text(`Total Sales: Rs.${totalRevenue.toLocaleString()}.00`, 60, doc.y + 5)
      .text(`Total Coupon Discount: Rs.${totalCouponDiscount.toLocaleString()}.00`, 60, doc.y + 5)
      .text(`Total Product Discount: Rs.${totalProductDiscount.toLocaleString()}.00`, 60, doc.y + 5)
      .moveDown(2);


    doc.fontSize(12).text("Order Details", { align: "center" }).moveDown(0.5);

    const tableTop = doc.y;
    const columnSpacing = 20;
    const columns = {
      orderId: { x: 50, width: 180 },
      customer: { x: 250, width: 120 },
      amount: { x: 390, width: 80 },
      date: { x: 490, width: 60 }
    };


    doc.fillColor("#4CAF50")
      .rect(50, tableTop, 500, 20)
      .fill();

    doc.fillColor("white")
      .fontSize(10);

    Object.entries(columns).forEach(([key, column]) => {
      const header = key.charAt(0).toUpperCase() + key.slice(1);
      doc.text(header, column.x + columnSpacing / 2, tableTop + 5, {
        width: column.width,
        align: key === 'amount' ? 'right' : 'left'
      });
    });


    let rowTop = tableTop + 25;
    const rowHeight = 20;

    orders.forEach((order, i) => {

      if (i % 2 === 0) {
        doc.fillColor("#f5f5f5")
          .rect(50, rowTop, 500, rowHeight)
          .fill();
      }

      doc.fillColor("black")
        .text(order._id.toString(), columns.orderId.x + columnSpacing / 2, rowTop + 5, {
          width: columns.orderId.width,
          align: 'left'
        })
        .text(order.userId.name, columns.customer.x + columnSpacing / 2, rowTop + 5, {
          width: columns.customer.width,
          align: 'left'
        })
        .text(`Rs.${order.finalAmount.toLocaleString()}.00`, columns.amount.x + columnSpacing / 2, rowTop + 5, {
          width: columns.amount.width,
          align: 'right'
        })
        .text(moment(order.createdAt).format("DD/MM/YYYY"), columns.date.x + columnSpacing / 2, rowTop + 5, {
          width: columns.date.width,
          align: 'left'
        });

      rowTop += rowHeight;


      if (rowTop > doc.page.height - 50) {
        doc.addPage();
        rowTop = 50;
      }
    });


    doc.rect(50, tableTop, 500, rowTop - tableTop).stroke();


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



const getSalesReportExcel = async (req, res) => {
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
        filter.createdAt = { $gte: new Date(today.setHours(0, 0, 0, 0)), $lte: new Date() };
      } else if (filterBy === "weekly") {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        filter.createdAt = { $gte: lastWeek, $lte: new Date() };
      } else if (filterBy === "monthly") {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        filter.createdAt = { $gte: lastMonth, $lte: new Date() };
      } else if (filterBy === "yearly") {
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        filter.createdAt = { $gte: lastYear, $lte: new Date() };
      }
    }

    const orders = await Order.find(filter)
      .populate("userId", "name email phone")
      .populate("orderedItems.productId", "productName salePrice")
      .sort({ createdAt: -1 });
    const totalOrders = orders.length;

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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // Header Row
    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 25 },
      { header: "Customer Name", key: "customer", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Total Amount (Rs.)", key: "amount", width: 15 },
      { header: "Date", key: "date", width: 15 },
    ];

    // Add Data Rows
    orders.forEach((order) => {
      worksheet.addRow({
        orderId: order._id.toString(),
        customer: order.userId.name,
        email: order.userId.email,
        phone: order.userId.phone,
        amount: `Rs.${order.finalAmount.toLocaleString()}.00`,
        date: moment(order.createdAt).format("DD/MM/YYYY"),
      });
    });

    worksheet.addRow({}); // Empty row for spacing
    worksheet.addRow(["Summary"]).font = { bold: true }; // Title Row

    worksheet.addRow(["Total Orders", totalOrders]);
    worksheet.addRow(["Total Revenue (Rs.)", `Rs.${totalRevenue.toLocaleString()}.00`]);
    worksheet.addRow(["Total Coupon Discount (Rs.)", `Rs.${totalCouponDiscount.toLocaleString()}.00`]);
    worksheet.addRow(["Total Product Discount (Rs.)", `Rs.${totalProductDiscount.toLocaleString()}.00`]);


    // Save the Excel file
    const salesReportDir = path.join(__dirname, "../../public/salesReport");
    if (!fs.existsSync(salesReportDir)) {
      fs.mkdirSync(salesReportDir, { recursive: true });
    }

    const filePath = path.join(salesReportDir, "sales_report.xlsx");
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath, "Headshield_sales_report.xlsx", (err) => {
      if (err) {
        console.error("Error downloading Excel file:", err);
        res.status(500).send("Error downloading Excel file");
      }
      fs.unlinkSync(filePath);
    });

  } catch (error) {
    console.error("Error generating Excel report", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getSalesReport,
  getSalesReportPDF,
  getSalesReportExcel
};
