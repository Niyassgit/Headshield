const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const PDFDocument=require("pdfkit");
const fs = require("fs");
const path = require("path");


const moment = require("moment");

// Generate and display sales report in the admin panel
const getSalesReport = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;
  
      const { filterBy, fromDate, toDate } = req.query;
  
      let filter = { status: { $in: ["Delivered", "Return Rejected"] } };
  
      // Date-based filtering
      if (fromDate && toDate) {
        filter.createdAt = {
          $gte: new Date(fromDate),
          $lte: new Date(toDate),
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
        }
      }
  
      // Fetch orders and sales summary
      const totalOrders = await Order.countDocuments(filter);
      const totalSales = await Order.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: "$finalAmount" },
          },
        },
      ]);
  
      const totalRevenue = totalSales.length > 0 ? totalSales[0].total : 0;
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
  
  // Generate and download sales report as PDF
  const getSalesReportPDF = async (req, res) => {
    try {
      const { filterBy, fromDate, toDate } = req.query;
      let filter = { status: { $in: ["Delivered", "Return Rejected"] } };
  
      // Date filtering logic
      if (fromDate && toDate) {
        filter.createdAt = {
          $gte: new Date(fromDate),
          $lte: new Date(toDate),
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
        }
      }
  
      // Fetching orders
      const orders = await Order.find(filter)
        .populate("userId", "name email phone")
        .populate("orderedItems.productId", "productName salePrice")
        .sort({ createdAt: -1 });
  
      const totalSales = orders.reduce((sum, order) => sum + order.finalAmount, 0);
      const totalOrders = orders.length;
  
      // Ensure salesReport directory exists
      const salesReportDir = path.join(__dirname, "../../public/salesReport");
      if (!fs.existsSync(salesReportDir)) {
        fs.mkdirSync(salesReportDir, { recursive: true });
      }
  
      const filePath = path.join(salesReportDir, "sales_report.pdf");
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
  
      // PDF Content
      doc.fontSize(24).font("Helvetica-Bold").text("Headshield", { align: "center" }).moveDown(0.5);
      doc.fontSize(16).font("Helvetica").text("Sales Report", { align: "center" }).moveDown(0.5);
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString("en-US")}`, { align: "center" }).moveDown(1);
  
      // Summary
      doc.rect(50, doc.y, 500, 60).stroke();
      doc.fontSize(12).text("Summary", 60, doc.y + 10).fontSize(10)
        .text(`Total Orders: ${totalOrders}`, 60, doc.y + 5)
        .text(`Total Sales: ₹${totalSales.toLocaleString()}.00`, 60, doc.y + 5)
        .moveDown(2);
  
      // Table headers
      const tableTop = doc.y;
      const tableHeaders = ["Order ID", "Date", "Customer Name", "Status", "Amount"];
      const columnWidths = [120, 80, 140, 80, 80];
      let xPosition = 50;
  
      doc.rect(50, tableTop, 500, 20).fill("#f0f0f0");
      doc.font("Helvetica-Bold").fontSize(10);
      tableHeaders.forEach((header, i) => {
        doc.fillColor("black").text(header, xPosition, tableTop + 5, {
          width: columnWidths[i],
          align: header === "Amount" ? "right" : "left",
        });
        xPosition += columnWidths[i];
      });
  
      // Table rows
      doc.font("Helvetica").fontSize(9);
      let yPosition = tableTop + 25;
  
      orders.forEach((order, index) => {
        if (yPosition > 750) {
          doc.addPage();
          yPosition = 50;
  
          xPosition = 50;
          doc.rect(50, yPosition, 500, 20).fill("#f0f0f0");
          doc.font("Helvetica-Bold").fontSize(10);
          tableHeaders.forEach((header, i) => {
            doc.fillColor("black").text(header, xPosition, yPosition + 5, {
              width: columnWidths[i],
              align: header === "Amount" ? "right" : "left",
            });
            xPosition += columnWidths[i];
          });
          doc.font("Helvetica").fontSize(9);
          yPosition += 25;
        }
  
        if (index % 2 === 0) {
          doc.rect(50, yPosition - 5, 500, 20).fill("#f9f9f9");
        }
  
        xPosition = 50;
        doc.fillColor("black").text(order._id.toString().slice(-8), xPosition, yPosition, { width: columnWidths[0] });
  
        xPosition += columnWidths[0];
        doc.text(new Date(order.createdAt).toLocaleDateString(), xPosition, yPosition, { width: columnWidths[1] });
  
        xPosition += columnWidths[1];
        doc.text(order.userId.name, xPosition, yPosition, { width: columnWidths[2] });
  
        xPosition += columnWidths[2];
        doc.text(order.status, xPosition, yPosition, { width: columnWidths[3] });
  
        xPosition += columnWidths[3];
        doc.text(`₹${order.finalAmount.toLocaleString()}.00`, xPosition, yPosition, {
          width: columnWidths[4],
          align: "right",
        });
  
        yPosition += 20;
      });
  
      doc.fontSize(8).text("© 2024 Headshield. All rights reserved.", 50, 780, { align: "center" });
  
      doc.end();
  
      // File download and delete
      stream.on("finish", () => {
        res.download(filePath, "Headshield_sales_report.pdf", (err) => {
          if (err) {
            console.error("Error downloading PDF:", err);
            res.status(500).send("Error downloading PDF");
          }
          fs.unlinkSync(filePath); // Delete file after download
        });
      });
    } catch (error) {
      console.log("Error generating sales report PDF", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
module.exports = {
getSalesReport,
getSalesReportPDF
 
};
