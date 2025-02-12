const Order=require("../../models/orderSchema");
const User=require("../../models/userSchema");
const Address=require("../../models/addressSchema");



const getOrderslist = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;  
        let limit = 5; 
        let skip = (page - 1) * limit; 

        const totalOrders = await Order.countDocuments();

        const orders = await Order.find()
            .populate("userId", "name")
            .sort({ createdAt: -1 }) 
            .skip(skip)
            .limit(limit);

        if (!orders) {
            return res.status(404).json({ success: false, message: "Cannot find orders" });
        }

        let totalPage = Math.ceil(totalOrders / limit);

        return res.render("ordersList", {
            orders: orders,
            currentPage: page,
            totalPage: totalPage
        });

    } catch (error) {
        console.error("Error while rendering orders list", error);
        return res.redirect("/admin-error");
    }
};

const getOrderDetails=async(req,res)=>{
    try {
        const orderId=req.query.orderId;
        const orderData=await Order.findOne({_id:orderId}).populate("orderedItems.productId", "productName productImage").exec();
        if(!orderData){
            return res.status(404).json({success:false,message:"Failed to find the order"})
        }
       const addressDoc=await Address.findOne({userId:orderData.userId});
       if(!addressDoc){
        return res.status(404).json({success:false,message:"Failed to finf Address"});
       }
       let selectedAddress = null;

       if (addressDoc && addressDoc.address.length > 0) {
         selectedAddress = addressDoc.address.find((addr) =>
           addr._id.equals(orderData.address)
         );
       }

       const products = orderData.orderedItems.map(item => ({
        productImage: item.productId?.productImage || 'default-image.jpg', 
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity
      }))

       return res.status(200).render("orderDetails",{
          orders:orderData,
          address:selectedAddress,
          products  :products
        })
    } catch (error) {
        console.error("Errror in order details page",error);
        return res.status(500).json({success:false,message:"Internal Server Error"});
        
    }
}

module.exports={

    getOrderslist,
    getOrderDetails
}
