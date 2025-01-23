const mongoose=require("mongoose");

const {Schema}=mongoose;

const productSchema= new Schema({

    productName:{
        type:String,
        required:true,
    },
    description:{
       
        type:String,
        required:true,
    },
    brand:{
        type:String,
        required:true,
    },
    category:{
       type:Schema.Types.ObjectId,
       ref:"Category",
       required:true,        
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salePrice:{
        type:Number,
         required:true
        
    },
    productOffer:{
        type:Number,
        default:0,
    },
    quantity:{
        type:Number,
        defult:0,
    },
    color:{
        type:String,
        required:true
    },
    size:{
        type:String,
        required:false
    },
    productImage:{
         type:[String],
         required:true
    },
    isBlocked:{
        type:Boolean,
        defult:false
    },
    status:{
        type:String,
        enum:["Available","out of stock","Discountinued"],
        required:true,
         default:"Available"
    },

},{timestamps:true});

const Product=mongoose.model("Product",productSchema)

module.exports=Product;