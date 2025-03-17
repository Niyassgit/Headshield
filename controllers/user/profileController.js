const User=require("../../models/userSchema");
const nodemailer=require("nodemailer");
const env=require("dotenv").config();
const session=require("express-session");
const bcrypt=require("bcrypt");
const Address=require("../../models/addressSchema");


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
        const storedOtp = req.session.userOtp;
        const otpExpiry = req.session.otpExpiresAt;

        if (!storedOtp || !otpExpiry || Date.now() > otpExpiry) {
            req.session.userOtp = null; 
            req.session.otpExpiresAt = null;
            return res.json({ success: false, message: "OTP has expired. Please request a new one." });
        }


        if (enteredOtp == storedOtp) {
            req.session.userOtp = null; 
            req.session.otpExpiresAt = null;
            return res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            return res.json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        return res.json({ success: false, message: "An error occurred. Please try again later." });
    }
};


const getResetPassPage=async(req,res)=>{

    try {
        res.render("reset-password");
    } catch (error) {
        
        res.redirect('/pageNotFound')
    }
};
const resendOtp = async (req, res) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        req.session.otpExpiresAt = Date.now() + 60000; 

        const email = req.session.email;
     

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {

            return res.status(200).json({ success: true, message: "Resend OTP Successful" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to send OTP. Try again later." });
        }
    } catch (error) {
        console.error('Error in resend OTP:', error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


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
};
const userProfile=async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData= await User.findById(userId);
       ({userId:userId});
        res.render("userProfile",{
            user:userData,
        })
    } catch (error) {
        console.error("Error while rendering user profile data:",error);
        res.redirect("/pageNotFound");
    }
};

const editProfile=async(req,res)=>{
    try {
        const userId=req.session.user;
        const {name,phone}=req.body;

        const user = await User.findByIdAndUpdate(userId, { $set: { name, phone } }, { new: true });
        if(!user){
            return res.status(404).json({success:false,message:"Failed to find the User."});
        }
        return res.status(200).json({success:true,message:"profile Updated successfully."});
    } catch (error) {
        console.error("Error while updating user profile");
        return res.status(500).json({success:false,message:"Internal Server Error"});
        
    }
}

const changePassword = async(req,res)=>{

    try {

        const user = req.session.user;
        const userData= await User.findOne({_id:user});
        res.render("change-password",{
             user:userData
        })
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const changePasswordValid = async (req,res)=>{
    try {

        const {email}=req.body;
        const userExists= await User.findOne({email});

        if(userExists){
            const otp= generateOtp();
            const emailSent= await sendVerificationEmail(email,otp);
            if(emailSent){

                req.session.userOtp=otp;
                req.session.userData=req.body;
                req.session.email=email;
                const userId=req.session.user;
                const userData=await User.findById({_id:userId});
                res.render("change-password-otp",{
                    user:userData,
                });
            
            }else{
                res.json({

                    success:false,
                    message:"Failed to send otp.Please try again",
                })
            }
        }else{
            res.render("change-password",{
                message:"User with this email does not exist"
            })
        }
        
    } catch (error) {
        console.log("Error in change password validation",error);
        res.redirect("/pageNotFound")
    }
};
const verifyChangePassOtp= async(req,res)=>{
  try {
    const EnteredOtp=req.body.otp;
      
    if(req.session.userOtp == EnteredOtp){
        res.json({success:true,redirectUrl:"/reset-password-user"})
    }else{
        res.json({success:false, message:"Failed to match Otp"})
    }
    
  } catch (error) {
    res.status(500).json({success:false, message:"an error occured,please try again later"});
  }

}

const getResetPassPageUser =async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById({_id:userId});
        res.render("resetPassword-User",{
            user:userData,
        });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};
const addAddress = async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        res.render("add-address",{
         user:userData,

        })
        
    } catch (error) {
        
    }
};
const postAddAddress= async(req,res)=>{
    try {
        const userId=req.session.user;
        const userData=await User.findOne({_id:userId});
        const {addressType,name,phone,altPhone,landMark,city,state,country,pincode}= req.body

        const userAddress = await Address.findOne({userId:userData._id});

        if(!userAddress){
            const newAddress = new Address({
                userId:userData._id,
                address:[{addressType,name,phone,altPhone,landMark,city,state,country,pincode}]
            });
            await newAddress.save();

        }else{
            userAddress.address.push({addressType,name,phone,altPhone,landMark,city,state,country,pincode});
            await userAddress.save();
        }
        res.redirect("/address");
    } catch (error) {
        console.log("Error adding Address:",error);
        res.redirect("/pageNotFound");
    }
};
const getAllAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressDocs = await Address.find({ userId: userData._id });
        let addressList = [];
        addressDocs.forEach((doc) => {
            addressList = addressList.concat(doc.address);
        });

        res.render("getAllAddress", {
            user: userData,
            address: addressList 
        });

    } catch (error) {
        console.log("Error rendering address page:", error);
        res.redirect("/pageNotFound");
    }
};

const editAddress= async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        const addressId=req.query.id;
        const currAddress = await Address.findOne({
            "address._id":addressId,
        });
        if(!currAddress){
            return res.redirect("/pageNotFound");
        }

        const addressData=currAddress.address.find((item)=>{
            return item._id.toString()=== addressId.toString();
        });
        if(!addressData){
            return res.redirect("/pageNotFound");
        }
        res.render("edit-address",{

            user:userData,
            address:addressData
        })
        
    } catch (error) {
        console.error("error in edit address:",error);
        res.redirect("/pageNotFound");
    }
};

const postEditAddress=async(req,res)=>{
    
    try {
        const {id,addressType,name,phone,altPhone,landMark,city,state,country,pincode}= req.body
        const findAddress=await Address.findOne({"address._id":id});
        if(!findAddress){
           return res.redirect("/pagNotFound");

        }
        await Address.updateOne({
            "address._id":id},
       { $set: {
                    "address.$.addressType": addressType,
                    "address.$.name": name,
                    "address.$.phone": phone,
                    "address.$.altPhone": altPhone,
                    "address.$.city": city,
                    "address.$.landMark": landMark,
                    "address.$.city": city,
                    "address.$.state": state,
                    "address.$.pincode": pincode,
                    "address.$.country": country
                }
        
                })

     return res.redirect("/address");

        
    } catch (error) {
        console.log("error in updating address",error);
        res.redirect("/pageNotFound");
   
    }

};

const deleteAddress =async(req,res)=>{

    try {
        const addressId= req.query.id;
        const findAddress=await Address.findOne({"address._id":addressId});

        if(!findAddress){

            return res.status(404).send("Address not Found");
        }
        await Address.updateOne({
            "address._id":addressId,
        },{
            $pull:{
                address:{
                    _id:addressId,
                }
            }
        }
    )
    res.redirect("/address");

    } catch (error) {
        console.log("error while deleting address:", error);
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
    userProfile,
    editProfile,
    changePassword,
    changePasswordValid,
    verifyChangePassOtp,
    getResetPassPageUser,
    addAddress,
    postAddAddress,
    getAllAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
   
}