const User=require("../../models/userSchema");


const customerInfo=async(req,res)=>{
 
    
    try {
        let search =req.query.search||'';
        let page = parseInt(req.query.page) || 1;
        const limit=3
        const userData=await User.find({isAdmin:false,$or:[  { name: { $regex: ".*" + search + ".*", $options: "i" } },
            { email: { $regex: ".*" + search + ".*", $options: "i" } },],}).limit((limit*1)).skip((page-1)*limit).sort({createdOn:-1}).exec();
        const count=await User.find({

            isAdmin:false,
            $or:[  { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        }).countDocuments();

        res.render("customers",{
            data: userData,
            totalPage: Math.ceil(count / limit),
            currentPage: page,
            search: search,      
        });
    } catch (error) {
        console.error("Error fetching customer data :",error);
        res.status(500).render("admin-error",{message:"An error occured while fetching data."})
    }
}

const customerBlocked=async(req,res)=>{
  
    try {
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("users");
        
    } catch (error) {
        res.redirect("page-error");
    }

}
const customerUnBlocked=async(req,res)=>{
    try {
        let id =req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("users");
       
    } catch (error) {
        res.redirect("page-error");
    }

}

module.exports={

    customerInfo,
    customerBlocked,
    customerUnBlocked,



}