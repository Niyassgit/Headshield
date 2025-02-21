const Brand=require("../../models/brandSchema");
const Product=require("../../models/productSchema");



const getBrandPage=async (req,res)=>{

    try {
        const page =parseInt(req.query.page) || 1;
        const limit=3;
        const skip = (page-1)*limit;

        const brandData=await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
        const totalBrands=await Brand.countDocuments();
        const totalPages=Math.ceil(totalBrands/limit);
       
        res.render("brands",{
            brands:brandData,
            currentPage:page,
            totalPage:totalPages,
            totalBrands:totalBrands,
        });
    } catch (error) {
        
        res.redirect("/admin-error");
    }
}

const addBrand = async (req, res) => {
    try {
      const brand = req.body.brandName;
      const findBrand = await Brand.findOne({ brandName: new RegExp(`^${brand}$`, 'i') });
  
      if (!findBrand) {
        const image = req.file.filename;
        await Brand.create({
          brandName: brand,
          brandImage: image,
        });
        
        return res.redirect("/admin/brands");
      } else {
        return res.status(400).json({
          success: false,
          message: "Oops! You are trying to add an existing brand!",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      res.redirect("/admin-error");
    }
  };
  
const blockBrand=async(req,res)=>{

    try {
        const id=req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/brands");
    } catch (error) {
        console.error("block error",error);
        res.redirect("/admin-error");
    }
}

const unBlockBrand=async(req,res)=>{

    try {
        
        const id=req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/brands");
    } catch ({error}) {
        console.error("error while unblocking",error);
        res.redirect("/admin-error");
    }
};
const deleteBrand=async(req,res)=>{

    try {
        const {id}=req.query;
        if(!id){
            return res.status(400).redirect("/admin-error");
        }
        await Brand.deleteOne({_id:id});
        res.redirect("/admin/brands");
    } catch (error) {
        console.error("error while deleting",error);
        res.status(500).redirect("/admin-error");
    }
};

module.exports={

    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand


}