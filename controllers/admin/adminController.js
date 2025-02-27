const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { ProfilingLevel } = require("mongodb");




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
        if (req.session.admin) {
            return res.render('dashboard')
        }
        else {
            return res.redirect('/admin/login')
        }
    } catch (error) {
        return res.redirect('/admin-error')
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,

};