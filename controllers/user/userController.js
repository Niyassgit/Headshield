const User=require("../../models/userSchema");
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema");
const nodemailer=require("nodemailer");
const env=require("dotenv").config();
const bcrypt=require("bcrypt");


const pageNotFound=async (req,res)=>{

    try{
       
      return  res.render("page-404");
    }catch(error){

    res.redirect("/pageNotFound")
    }
};

const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        })
        .sort({ createdAt: -1 }) 
        .limit(3); 

        if (user) {
            const userData = await User.findOne({ _id: user });
            return res.render("home", { user: userData, products: productData });
        } else {
            return res.render("home", { user: null, products: productData });
        }

    } catch (error) {
        console.error("Error loading homepage:", error);
        res.status(500).send("Server Error");
    }
};


const loadSignup= async(req,res)=>{

    try{

        if(req.session){

            const errorMessage=req.session.errorMessage;
            req.session.errorMessage=null;

         return res.render("signup",{message:errorMessage});
        }

    }catch(error){
        console.log("Signup page is not found",error);
        res.status(500).send("Server Error");


    }
}



function generateOtp(){
 
    return Math.floor(100000+Math.random()*900000).toString();

}

async function sendVerificationEmail(email,otp){

    try {

        const transporter= nodemailer.createTransport({

            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD

            }

        })

        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your accoount",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP:${otp}</b>`,
        })
        return info.accepted.length>0
        
    } catch (error) {
        
        console.error("Error sending email",error);
        return false;
    }
}

const signup = async (req, res) => {
    try {
        const { name, phone, email, password, cPassword } = req.body;

        if (password !== cPassword) {
            req.session.errorMessage="Password do not match";
            return res.redirect("/signup");
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            req.session.errorMessage="User with the same email already exists";
            return res.redirect("signup");
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }


        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };

        console.log("Session after setting OTP:", req.session);

        return res.render("Verify-otp");
    } catch (error) {
        console.error("Signup error:", error);
        return res.redirect("page-404");
    }
};


const securePassword=async (password)=>{

    try {

        const passwordHash= await bcrypt.hash(password,10)
        return passwordHash;
        
    } catch (error) {
        console.error("Error in Secure Password",error);
        throw error;
    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log("Session OTP:", req.session.userOtp);

        if (otp.toString() === req.session.userOtp.toString()) {

            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);
          

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
                ...(user.googleId && { googleId: user.googleId }), 
            });

            try {
                await saveUserData.save();
                req.session.user = saveUserData._id;
                return res.json({ success: true, redirectUrl: "/" });
            } catch (dbError) {
                if (dbError.code === 11000) {
                
                    return res.status(400).json({
                        success: false,
                        message: "Email or phone number already registered.",
                    });
                }
            
                return res.status(500).json({ success: false, message: "Failed to save user data." });
            }
        } else {
            
            return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error Verifying OTP:", error);
        return res.status(500).json({ success: false, message: "An error occurred while verifying OTP." });
    }
};

const loadLogin = async (req,res)=>{

    try {
        
        if(!req.session.user){
            const loginFailedMessage=req.session?.userLoginError;
            req.session.userLoginError=null;
            return res.render("login",{message:loginFailedMessage});
        }else{

            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}


const login= async (req,res)=>{
    try {

        const {email,password}=req.body;
        const findUser= await User.findOne({isAdmin:0,email:email});

        if(findUser){

            const passwordMatch= await bcrypt.compare(password,findUser.password);

            if(passwordMatch){

                req.session.user=findUser._id;
                return res.redirect("/");
            }else{
                req.session.userLoginError="Incorrect Password";
                return res.redirect("/login")
            }
        }else{
            req.session.userLoginError="User is not Found";
            return res.redirect("/login");
        }
        
    } catch (error) {
        req.session.userLoginError="Login failed.Please try again later"
        console.error("login Error",error);
        return res.redirect("/login");
    }
}
const logout=async(req,res)=>{

    try{
           req.session.destroy(err=>{
            if(err){
                console.log("Error destroy session",err);
                return res.redirect("/page-404");
            }
           });
            return res.redirect("/");
    } catch (error) {
        console.error('logout error:',error);
        res.redirect("/page-404");
    }
};

const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;

        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id.toString());

        const selectedCategory = req.query.category;
        const searchQuery = req.query.q ? req.query.q.trim() : null;
        const sortOption = req.query.sort || "latest"; 

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        let filter = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (selectedCategory && categoryIds.includes(selectedCategory)) {
            filter.category = selectedCategory;
        } else {
            filter.category = { $in: categoryIds };
        }
        if (searchQuery) {
            filter.productName = { $regex: searchQuery, $options: "i" }; 
        }

        let sortQuery = {};
        if (sortOption === "price_asc") sortQuery = { salePrice: 1 };
        else if (sortOption === "price_desc") sortQuery = { salePrice: -1 };
        else if (sortOption === "name_asc") sortQuery = { productName: 1 };
        else if (sortOption === "name_desc") sortQuery = { productName: -1 };
        else if (sortOption === "latest") sortQuery = { createdAt: -1 };


        const products = await Product.find(filter)
            .sort(sortQuery)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        const brands = await Brand.find({ isBlocked: false });

        return res.render("shop", {
            user: userData,
            products: products,
            category: categories,
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            selectedCategory: selectedCategory || null,
            sort: sortOption,
            searchQuery,
            noResults: products.length === 0 
        });

    } catch (error) {
        console.error("Error loading shop page:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports={

    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    loadLogin,
    login,
    logout,
    loadShoppingPage,
}