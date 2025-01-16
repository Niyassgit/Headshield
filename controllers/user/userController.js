const User=require("../../models/userSchema");
const nodemailer=require("nodemailer");
const env=require("dotenv").config();
const bcrypt=require("bcrypt");

const pageNotFound=async (req,res)=>{

    try{
       
      return  res.render("page-404");
    }catch(error){

    res.redirect("/pageNotFound")
    }
}
const loadHomepage= async (req,res)=>{
     
    try{
       
        return res.render("home");
         
    }catch(error){
         
        console.log("Home page is not found",error);
        res.status(500).send("server error")
    }
}

const loadSignup= async(req,res)=>{

    try{
       return res.render("signup");

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
            console.log("Passwords do not match");
            return res.render("signup", { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            console.log("User already exists");
            return res.render("signup", { message: "User with the same email already exists" });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            console.log("Failed to send email");
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }

        // Debugging session
        console.log("Session before setting OTP:", req.session);

        // Store OTP and user data in the session
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
                ...(user.googleId && { googleId: user.googleId }), // Add googleId only if it exists
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
            return res.render("login");
        }else{

            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}


const login =async (req,res)=>{

    try {
        
        const {email,password}=req.body;

        const findUser=await User.findOne({isAdmin:0,email:email});
        if(!findUser){

            return res.render("login",{message:"User not found"});

        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked by admin"});
        }
        const passwordMatch=await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }
        req.session.user=findUser._id;
        res.redirect("/")
    } catch (error) {
        
        console.error("login error",error);
        res.render("login",{message:"login failed.Please try again later"})
    }
}
module.exports={

    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    loadLogin,
    login
}