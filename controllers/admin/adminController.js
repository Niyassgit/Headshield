const User=require("../../models/userSchema");
const mongoose=require("mongoose");
const bcrypt= require("bcrypt");
const { ProfilingLevel } = require("mongodb");




const pageError=async(req,res)=>{

   res.render("admin-error");
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin");
    }
    res.render("admin-login", { message: null });
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (admin) {
            // Await the password comparison
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                console.log("password matched");
                req.session.admin = true; // Set the session variable
                return res.redirect("/admin"); // Redirect to the admin dashboard
            } else {
                console.log("matching password filed")
                return res.redirect("/admin/login"); // Redirect to the login page if password is incorrect
            }
        } else {
            console.log("not An admin")
            return res.redirect("/admin/login"); // Redirect to the login page if admin not found
        }
    } catch (error) {
        console.error("Login error", error);
        return res.redirect("/pageerror"); // Redirect to an error page
    }
};
const loadDashboard=async (req,res) => {
    try {
      if(req.session.admin){
       return res.render('dashboard')
      }
      else{
        return res.redirect('/admin/login')
      }
    } catch (error) {
      return res.redirect('/admin-error')
    }
  };
  
const logout= async(req,res)=>{

    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroy session",err);
                return res.redirect("/admin-error");
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout",error);
        res.redirect("/pageerror")
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
  
};