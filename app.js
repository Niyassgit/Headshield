const express = require('express');
const app=express();
const env=require("dotenv")
const db=require("./config/db");
env.config()
db();

 

app.listen(parseInt(process.env.PORT),()=>{

    console.log(`server is running on http://localhost:3000`)
})

module.exports=app;     