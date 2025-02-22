const User=require("../../models/userSchema");
const Wallet=require("../../models/walletSchema");
const Order=require("../../models/orderSchema");

const getWalletAdd=async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        let wallet=await Wallet.findOne({userId:userId});

  
    if (!wallet) {
      wallet = await Wallet.create({
        userId: userId,
        balance: 0, 
        transactions: [],
      });
    }

        return res.render("walletPage",{
            user:userData,
            balance:wallet.balance,

        })
        
    } catch (error) {
        console.error("Error while loading Wallet",error);
        return res.status(500).json({success:false,message:"Internal Server Error"});
        
    }
};


const addMoney = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.session.user; 

        let wallet = await Wallet.findOneAndUpdate(
            { userId: userId }, 
            { $inc: { balance: amount } },
            { new: true } 
        );

        if (!wallet) {
       
            wallet = await Wallet.create({
                userId: userId,
                balance: amount
            });
        }
   
        return res.status(200).json({ success: true, message: "Amount added to Wallet successfully.", wallet });

    } catch (error) {
        console.error("Error while adding Wallet Amount:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const getWalletHistory=async(req,res)=>{

    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        const wallet=await Wallet.findOne({userId:userId});

        if(!wallet){
            return res.status(404).json({success:false,message:"Wallet not found!"});
        }
        

        return res.render("WalletHistory",{
            user:userData,
            wallet:wallet,
           
        })
    } catch (error) {
      console.error("Error while rendering Wallet History",error);
      return res.status(500).json({success:false,message:"Internal Server Error"});
        
    }
};



module.exports={
    getWalletAdd,
    addMoney,
    getWalletHistory
}