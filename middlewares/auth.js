
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





module.exports={
  userAuth,
  adminAuth
}