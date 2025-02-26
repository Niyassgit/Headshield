// const CustomError = require("../helpers/customeError");

// const errorHandler = (err, req, res, next) => {
//   const statusCode = err.statusCode || 500;
//   const message = err.message || "Something went wrong!";

 
//   if (req.originalUrl.startsWith("/api")) {
//     return res.status(statusCode).json({
//       success: false,
//       statusCode,
//       message
//     });
//   }


//   res.status(statusCode).render("page-404", {
//     statusCode,
//     message
//   });
// };

// module.exports = errorHandler;
