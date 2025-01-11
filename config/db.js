const env=require("dotenv").config();
const mongoose=require("mongoose");


const connectDB= ()=>{
   return new Promise((resolve,reject)=>{
    mongoose
        .connect("mongodb://127.0.0.1:27017/HeadShield")
        .then(() => resolve("Database connected successfully."))
        .catch((error) => reject("Error connecting to database:", error.message));
    
   })
}

module.exports=connectDB;  