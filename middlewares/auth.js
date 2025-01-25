
const userAuth = (req, res, next) => {
  console.log("Session in middleware:", req.session);
  if (req.session && req.session.user) {
      console.log("User is logged in.");
      return next(); 
  }
  console.log("User not logged in, redirecting to login page.");
  return res.redirect("/login"); 
};


const adminAuth = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {

    res.redirect('/admin/login');
  }
};





module.exports={
  userAuth,
  adminAuth
}