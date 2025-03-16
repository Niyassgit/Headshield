const User=require("../../models/userSchema");
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema");
const nodemailer=require("nodemailer");
const { applyBestOffer }=require("../../helpers/offerHelper");
const { getUserCartAndWishlistCount } = require("../../helpers/userHelper");
const env=require("dotenv").config();
const bcrypt=require("bcrypt");


const pageNotFound = async (req, res) => {
    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        return res.render("page-404",{user:userData});
    } catch (error) {
        console.error("Error rendering 404 page:", error);
        res.status(500).send("Internal Server Error"); 
    }
};


const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true });
        const blockedOrDeletedBrands = await Brand.find({$or:[{isBlocked:true},{isDeleted:true}]}).distinct("_id");

        await applyBestOffer();
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 },
            brand: { $nin: blockedOrDeletedBrands } 
        })
        .populate("brand","brandName")
        .sort({ createdAt: -1 }) 
        .limit(3); 

        if (user) {
            const userData = await User.findOne({ _id: user }).populate("cart wishlist");
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
            req.session.errorMessage = "Password do not match";
            return res.redirect("/signup");
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            req.session.errorMessage = "User with the same email already exists";
            return res.redirect("signup");
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }

        req.session.userOtp = otp;
        req.session.otpGeneratedTime = Date.now();
        req.session.userData = { name, phone, email, password };

        // Set timeout to clear OTP after 1 minute
        setTimeout(() => {
            if (req.session && req.session.userOtp) {
                req.session.userOtp = null;
                req.session.save();
            }
        }, 60000);

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

        if (!req.session.userOtp) {
            return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
        }

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
                // Clear the OTP data after successful verification
                req.session.userOtp = null;
                req.session.otpGeneratedTime = null;
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
        
        let selectedCategory = req.query.category;
        const searchQuery = req.query.q ? req.query.q.trim() : null;
        const sortOption = req.query.sort || "latest"; 
        const selectedBrand = req.query.brand;

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const deletedBrandIds = await Brand.find({ isDeleted: true }).distinct("_id");

        let filter = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (deletedBrandIds.length > 0) {
            filter.brand = { $nin: deletedBrandIds };
        }

        if (selectedCategory && categoryIds.includes(selectedCategory)) {
            filter.category = selectedCategory;
        } else if (!selectedCategory) {
            filter.category = { $in: categoryIds };
        }

        if (searchQuery) {
            const matchingBrands = await Brand.find({ 
                brandName: { $regex: searchQuery, $options: "i" },
                isDeleted: false 
            });
            
            const brandIds = matchingBrands.map(brand => brand._id);
            
            filter.$or = [
                { productName: { $regex: searchQuery, $options: "i" } },
                { description: { $regex: searchQuery, $options: "i" } },
                { brand: { $in: brandIds } }
            ];
        }

        if (selectedBrand) {
            const brand = await Brand.findOne({ 
                brandName: selectedBrand,
                isDeleted: false
            });
            
            if (brand) {
                if (filter.$or) {
                    filter = {
                        $and: [
                            { brand: brand._id },
                            filter
                        ]
                    };
                } else {
                    filter.brand = brand._id;
                }
            }
        }

        const blockedBrands = await Brand.find({ isBlocked: true }).distinct("_id");
        if (blockedBrands.length > 0) {
            if (filter.$and) {
                filter.$and.push({ brand: { $nin: blockedBrands } });
            } 
            else if (filter.$or) {
                filter = {
                    $and: [
                        { brand: { $nin: blockedBrands } },
                        filter
                    ]
                };
            } 
            else {
                if (filter.brand && !filter.brand.$in) {
                    if (blockedBrands.some(id => id.equals(filter.brand))) {
                        delete filter.brand;
                    }
                } else {
                    filter.brand = { $nin: blockedBrands };
                }
            }
        }

        let sortQuery = {};
        if (sortOption === "price_asc") sortQuery = { salePrice: 1 };
        else if (sortOption === "price_desc") sortQuery = { salePrice: -1 };
        else if (sortOption === "name_asc") sortQuery = { productName: 1 };
        else if (sortOption === "name_desc") sortQuery = { productName: -1 };
        else if (sortOption === "latest") sortQuery = { createdAt: -1 };

        await applyBestOffer(); 

        const products = await Product.find(filter)
            .populate("brand", "brandName")
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .lean();  
        
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        // Only include non-deleted brands in the dropdown
        const brands = await Brand.find({ 
            isBlocked: false,
            isDeleted: false
        });

        return res.render("shop", {
            user: userData,
            products: products,
            category: categories,
            brand: brands,
            totalPages: totalPages,
            currentPage: page,
            selectedCategory: selectedCategory || null,
            selectedBrand: selectedBrand || null,
            sort: sortOption,
            searchQuery,
            noResults: products.length === 0 
        }); 

    } catch (error) {
        console.error("Error loading shop page:", error);
        res.redirect("/pageNotFound");
    }   
};

const getCount = async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.json({ 
                success: true,
                cartCount: 0, 
                wishlistCount: 0,
                isGuest: true
            });
        }


        const { cartCount, wishlistCount } = await getUserCartAndWishlistCount(req.session.user);
        res.json({ 
            success: true,
            cartCount, 
            wishlistCount,
            isGuest: false
        });
    } catch (error) {
        console.error("Error fetching counts:", error);
        res.status(500).json({ 
            success: false,
            message: "Error fetching counts",
            cartCount: 0, 
            wishlistCount: 0 
        });
    }
};

const loadAboutPage= async(req,res)=>{
    try {
        const userId =req.session.user;
       const userData=await User.findById(userId);

       return res.render("aboutPage",{
        user:userData,
       });
        
    } catch (error) {
        console.error("Error while rendering About page",error);
        res.status(500).json({success:false,message:"Internal Server Error"});
        
    }
};
const resendOtp = async (req, res) => {
    try {
        if (!req.session.userData) {
            return res.status(400).json({ success: false, message: "Session expired. Please sign up again." });
        }

        // Check if the OTP was generated less than 1 minute ago
        const lastOtpTime = req.session.otpGeneratedTime || 0;
        const currentTime = Date.now();
        const timeDifference = (currentTime - lastOtpTime) / 1000; // in seconds

        if (timeDifference < 60) {
            return res.status(400).json({ 
                success: false, 
                message: "Please wait 1 minute before requesting a new OTP.",
                timeRemaining: Math.ceil(60 - timeDifference)
            });
        }

        const { email } = req.session.userData;
        const newOtp = generateOtp(); 

        req.session.userOtp = newOtp;
        req.session.otpGeneratedTime = Date.now();
        
        // Set timeout to clear OTP after 1 minute
        setTimeout(() => {
            if (req.session && req.session.userOtp) {
                req.session.userOtp = null;
                req.session.save();
            }
        }, 60000);

        await req.session.save(); 

        const emailSent = await sendVerificationEmail(email, newOtp);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to resend OTP email." });
        }

        return res.json({ success: true, message: "New OTP sent successfully." });

    } catch (error) {
        console.error("Error Resending OTP:", error);
        return res.status(500).json({ success: false, message: "An error occurred while resending OTP." });
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
    getCount,
    loadAboutPage,
    resendOtp,
}