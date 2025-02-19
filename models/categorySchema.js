const mongoose=require("mongoose");

const {Schema}=mongoose;

const categorySchema=new Schema({

    name:{
        type:String,
        required:true,
        unique:true
    },
    description:{
        type:String,
        required:true,

    },
    isListed:{
        type:Boolean,
        default:true,
    },
    categoryOffer:{
        type:Number,
        default:0,
    },
    expiredOn: {
        type: Date,
        required: false,
        validate: {
            validator: function(value) {
                return value > Date.now(); 
            },
            message: "Expiration date must be in the future."
        }
    },
    createdAt:{
     type:Date,
     default:Date.now,    
    }

})
const Category=mongoose.model("Category",categorySchema);

module.exports=Category;