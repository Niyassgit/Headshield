const Product=require("../../models/productSchema");
const Category= require("../../models/categorySchema");
const Brand=require("../../models/brandSchema");
const User=require("../../models/userSchema")
const fs=require("fs");
const path=require("path");
const sharp=require("sharp");


const getProductAddPage=async (req,res)=>{


    try {
        const category=await Category.find({isListed:true}); 
        const brand=await Brand.find({isBlocked:false}).sort({createdAt:-1});
        res.render("product-add",{
            cat:category,
            brand:brand,
        });
    } catch (error) {
        res.redirect("/admin-error");
    }
};

const addProducts= async(req,res)=>{
  try {
      
      const products=req.body;
      const productExists=await Product.findOne({productName:products.productName,

      });
      if(!productExists){
          const images=[];
          if(req.files && req.files.length>0){
              for(let i=0;i<req.files.length;i++){
                  const originalImagePath =req.files[i].path;
                  const resizedImagePath=path.join('public','uploads','product.images',req.files[i].filename);
                  await sharp(originalImagePath).resize({width:440,height:440}).toFile(resizedImagePath);
                  images.push(req.files[i].filename);
      
              }
          }
             const categoryId=await Category.findOne({name:products.category});
             if(!categoryId){
              return res.status(400).join("Invalid category name")
             }
             const newProduct =new Product({
              productName:products.productName,
              description:products.description,
              brand:products.brand,
              category:categoryId._id,
              regularPrice:products.regularPrice,
              salePrice:products.salePrice,
              createdOn:new Date(),
              quantity:products.quantity,
              size:products.size,
              color:products.color,
              productImage:images,
              status:"Available",
             });

             await newProduct.save();
             return res.redirect("/admin/addProducts");
      }else{
          return res.status(400).json("Product already exist,please try with another name");
      }
  } catch (error) {
      console.error("Error saving product",error);
      return res.redirect("/admin/admin-pageerror");
  }
}
const getAllProducts = async (req, res) => {
    try {
      const search = req.query.search || "";
      const page = req.query.page || 1;
      const limit = 4;
  
   
      const productData = await Product.find({
        $or: [
          { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
          { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
        ]
      })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('category')
        .exec();
  
      
      const count = await Product.find({
        $or: [
          { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
          { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
        ]
      }).countDocuments();
  
     
      const category = await Category.find({ isListed: true });
      const brand = await Brand.find({ isBlocked: false });
  
     
     
      if (category && brand) {
        res.render("products", {
          data: productData,
          currentPage: page,
          totalPage: Math.ceil(count / limit),
          cat: category,
          brand: brand
        });
      }
     } catch (error) {
   
      console.error("Error fetching product data:", error);
      res.redirect("/admin-error?message=" + encodeURIComponent("Error loading product data"));
    }
  };

  const productBlock=async(req,res)=>{

    try {

      const id=req.query.id;
      await Product.updateOne({_id:id},{$set:{isBlocked:true}});
      res.redirect("products");
      
    } catch (error) {
      res.redirect("/admin-error");
    }
  };

  const unBlockProduct=async(req,res)=>{

    try {

      const id=req.query.id;
      await Product.updateOne({_id:id},{$set:{isBlocked:false}});
      res.redirect("products");
      
    } catch (error) {
      res.redirect("/admin-error");
    }
  };
  
const getEditProduct=async(req,res)=>{

  try {

      const id =req.query.id;
      const product=await Product.findOne({_id:id});
      const brand =await Brand.find({});
      const category=await Category.find({});
      res.render("productEdit",{
        product:product,
        brand:brand,
        category:category
      })     
  } catch (error) {
      res.redirect("/admin-error")
  }
};

const editProduct=async(req,res)=>{
  
  try {

    const id=req.params.id;
    const product=await Product.findOne({_id:id});
    if (!product) {
      return res.status(404).send("Product not found");
    }
    const data=req.body;
    const existingProduct=await Product.findOneAndDelete({
      productName:data.productName,
      _id:{$ne:id}
    })
    if(existingProduct){

      return res.status(400).json({error:"Product with this name exists.Please try with another name"});
    }
const images=[];
if(req.files && req.files.length >0){
  for(let i=0;i<req.files.length;i++){
    images.push(req.files[i].filename);
  }
}

const updateFields={
  productName:data.productName,
  description:data.description,
  category:product.category,
  regularPrice:data.regularPrice,
  salePrice:data.salePrice,
  quantity:data.quantity,
  color:data.color,
  size:data.size,

}
if (req.files && req.files.length > 0) {
  updateFields.$push = { productImage: { $each: images } };
}
await Product.findByIdAndUpdate(id,updateFields,{new:true});
res.redirect("/admin/products");

    
  } catch (error) {
    console.error(error);
    res.redirect("/admin/admin-error");
  }
};
const deleteSingleImage = async (req, res) => {
  try {
      const { imageNameToServer, productIdToServer } = req.body;

      const product = await Product.findById(productIdToServer);
      if (!product) {
          console.error("Product not found");
          return res.status(404).send({ status: false, error: "Product not found" });
      }

      await Product.findByIdAndUpdate(productIdToServer, {
          $pull: { productImage: imageNameToServer }
      });

      const imagePath = path.join("public", "uploads", "re-image", imageNameToServer);
      if (fs.existsSync(imagePath)) {
          await fs.unlinkSync(imagePath);
      } else {
          console.log(`Image file ${imageNameToServer} not found on server`);
      }

      res.send({ status: true });
  } catch (error) {
      console.error("Error during image deletion:", error);
      res.status(500).send({ status: false, error: "Server error occurred" });
  }
};




  

module.exports={
    getProductAddPage,
    addProducts,  
    getAllProducts,  
    productBlock,
    unBlockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}