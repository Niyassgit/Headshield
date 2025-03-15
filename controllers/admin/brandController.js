const Brand=require("../../models/brandSchema");
const Product=require("../../models/productSchema");



const getBrandPage=async (req,res)=>{

    try {   
        const page =parseInt(req.query.page) || 1;
        const limit=3;
        const skip = (page-1)*limit;

        const brandData = await Brand.find({ isDeleted: { $ne: true } }).sort({createdAt:-1}).skip(skip).limit(limit);
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
            return res.status(200).json({
                success: true,
                message: "New Brand Added Successfully"
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Oops! You are trying to add an existing brand!"
            });
        }
    } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while adding the brand."
        });
    }
};

const blockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        console.log(id);
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });

        return res.status(200).json({
            success: true,
            message: "Brand has been blocked successfully."
        });
    } catch (error) {
        console.error("Block error", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while blocking the brand."
        });
    }
};


const unBlockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });

        return res.status(200).json({
            success: true,
            message: "Brand has been unblocked successfully."
        });
    } catch (error) {
        console.error("Error while unblocking", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while unblocking the brand."
        });
    }
};

const deleteBrand = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid brand ID."
            });
        }

        await Brand.findOneAndUpdate({ _id: id }, { isDeleted: true });

        return res.status(200).json({
            success: true,
            message: "Brand has been deleted successfully."
        });
    } catch (error) {
        console.error("Error while deleting", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while deleting the brand."
        });
    }
};


module.exports={

    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand


}