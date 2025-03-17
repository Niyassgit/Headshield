const mongoose=require("mongoose");

const {Schema}=mongoose;

const userSchema=new Schema({

    name:{
        type:String,
        required:true

    },
    email:{
        type:String,
        required:true,
        unique:true,

    },
    phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true,
        default:null

    },
    googleId: {
        type: String,
        unique: true,
        sparse:true
    },
    
    password:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist"
    }],
    
    cart:[{
            type:Schema.Types.ObjectId,
            ref:"Cart",
        }],
        orderHistory:[{

            type:Schema.Types.ObjectId,
            ref:"Order"
        }],
        createdOn:{
            type:Date,
            default:Date.now,
        },
        searchHistory:[{
         category:{
            type:Schema.Types.ObjectId,
            ref:"Category",
         },
         brand:{
            type:String,

         },
         searchOn:{
            type:Date,
            default:Date.now
         }

        }],
        referralCode: { 
            type: String,
            unique: true 
        },
        referredBy: {
             type: mongoose.Schema.Types.ObjectId, 
             ref: "User", 
             default: null 
        },


});

userSchema.pre("save", async function (next) {
    if (!this.referralCode) {
        let newCode;
        let isUnique = false;
        while (!isUnique) {
            newCode = Math.random().toString(36).substr(2, 8).toUpperCase();
            const existingUser = await mongoose.model("User").findOne({ referralCode: newCode });
            if (!existingUser) {
                isUnique = true;
            }
        }
        this.referralCode = newCode;
    }
    next();
});
const User=mongoose.model("User",userSchema);
module.exports=User;