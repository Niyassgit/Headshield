
const User=require("../models/userSchema");


const userAuth = (req, res, next) => {

  if (req.session && req.session.user) {
      return next(); 
  }
  return res.redirect("/login"); 
};


const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {

    res.redirect('/admin/login');
  }
};

const isBlocked= async(req,res,next)=>{

  try {
    if(!req.session.user)return next()
    else{
       const user =await User.findById(req.session.user) 
       if(user.isBlocked){
          req.session.userLoginError="User is Blocked"
          req.session.user = null;
          return res.redirect('/login')
       }
       next()
    }
 } catch (error) {
    console.log(error);
    res.redirect('/pageerror')
  
  }

};


module.exports={
  userAuth,
  adminAuth,
  isBlocked,

}