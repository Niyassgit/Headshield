const express = require('express');
const app = express();
const path = require("path");
const env = require("dotenv");
const db = require("./config/db");
const session = require("express-session");
const passport = require("./config/passport");
const userRouter = require("./routes/userRoutes");
const adminRouter = require("./routes/adminRouter");
env.config();
db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000,
    },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views/admin'),
]);


// Route setup
app.use("/", userRouter);
app.use("/admin", adminRouter);

app.listen(parseInt(process.env.PORT), () => {
    console.log(`Server is running on http://localhost:${process.env.PORT}`);
});

module.exports = app;