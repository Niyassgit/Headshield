const User=require("../../models/userSchema");
const nodemailer=require("nodemailer");
const env=require("dotenv").config();
const session=require("express-session");
const bcrypt=require("bcrypt");


function generateOtp(){
    const digits="1234567890";
    let otp="";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }

    return otp;
}

const sendVerificationEmail=async (email,otp)=>{

    try {
       
        const transporter= nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })

        const mailOptions ={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for password reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP: ${otp}</h4><br></b>`
        }
        const info=await transporter.sendMail(mailOptions);
        console.log('Email sent:',info.messageId);
        return true;

      
    } catch (error) {
        console.error('Error sending email',error);
        return false;
    }
}
const securePassword = async(password)=>{
     
    try {
        const passwordHash= await bcrypt.hash(password,10);
        return passwordHash;
        
    } catch (error) {
        console.error("Error while Hashing:",error);
    }
}
const forgotPassPage=async(req,res)=>{

  try {
    return res.render("forgot-password");
  } catch (error) {
     
    res.redirect("/pageNotFound")
  }
};

const forgotEmailValid=async(req,res)=>{
   try {

    const {email}=req.body;
    const findUser=await User.findOne({email:email});
   
    if(findUser){
        const otp=generateOtp();   
        const emailSent=await sendVerificationEmail(email,otp);
        if(emailSent){
            req.session.userOtp=otp;
            req.session.email=email;
            res.render("forgotPass-otp");
            console.log("OTP:",otp);


        }else{

            res.json({success:false,message:"Failed to send OTP.Please try again"}); 
        }
    }else{

        res.render("forgot-password",{message:"User with this email does not exist"});
    }
    
   } catch (error) {

    res.redirect("/pageNotFound");
    
   }

};
const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp == req.session.userOtp) {
            res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            res.json({ success: false, message: "OTP not matching" });
        }
    } catch (error) {
        res.json({ success: false, message: "An error occurred. Please try again later" });
    }
};

const getResetPassPage=async(req,res)=>{

    try {
        res.render("reset-password");
    } catch (error) {
        
        res.redirect('/pageNotFound')
    }
};

const resendOtp=async(req,res)=>{
    try {

        const otp=generateOtp();
        req.session.userOtp=otp;
        const email=req.session.email;
        console.log('Resending OTP to email:',email);
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
           console.log('Resend OTP:',otp);
           res.status(200).json({success:true,message:"Resend OTP Successful"}); 
        }
        
    } catch (error) {
       console.error('Error in resend OTP:',error);
        res.status(500).json({success:false, message:"Internal Server Error"});
    }
}

const postNewPassword = async(req,res)=>{

    try {
        const {newPassword,confirmPassword}= req.body;
        const email = req.session.email;
        if(newPassword== confirmPassword){
            const passwordHash= await securePassword(newPassword);
            await User.updateOne({email:email},{$set:{password:passwordHash}});
            res.status(200).json({success:true})
          
        }
        else{
            res.render("reset-password",{message:"Passwords do not match"});
        }
    } catch (error) {
        res.redirect("/pageNotFound");
        
    }
}

module.exports={

    forgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,

}