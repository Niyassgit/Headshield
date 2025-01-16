const express = require('express');
const app=express();
const path=require("path")
const env=require("dotenv")
const db=require("./config/db");
const session=require("express-session");
const passport=require("./config/passport")

const userRouter=require("./routes/userRoutes")
env.config()
db();

 
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));
app.use(session({
    secret:process.env.SESSION_SECRET ||"defualt-secret",
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000,
    },
}))

app.use(passport.initialize());
app.use(passport.session());

//Route setup
app.use("/",userRouter);
app.set("view engine","ejs");
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,'views/admin')]);

app.listen(parseInt(process.env.PORT),()=>{

    console.log(`server is running on http://localhost:3000`)
})

module.exports=app;     