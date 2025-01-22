const Category = require("../../models/categorySchema");

const categoryInfo = async (req, res) => {

    let searchQuery = req.query.search || '';
    

    let searchFilter = searchQuery
        ? {
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ]
        }
        : {};

    try {

        const page = Number(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;


        const categoryData = await Category.find(searchFilter).sort({ createdAt: -1 })
            .skip(skip).limit(limit);

        const totalCategories = await Category.countDocuments(searchFilter);
        const totalPages = Math.ceil(totalCategories / limit);
        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPage: totalPages,
            totalCategories,
            searchQuery

        });
       
    } catch (error) {
        console.error("category page load error", error);
        res.redirect("admin-error");
    }
}

const addCategory = async (req, res) => {

    const { name, description } = req.body;
    console.log("category data:", name, description);

    try {

        const ExistingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
        });
        if (ExistingCategory) {

            return res.status(400).json({ error: "Your are trying to add an existing product" })
        }
        const newCategory = new Category({

            name,
            description,
        });
        await newCategory.save();
     
        return res.status(200).json({
            success: true,
            message: 'Category added successfully',
            category: newCategory,
        });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" })
    }

};

const getListCategory = async (req, res) => {

    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect("/admin/category");
    } catch (error) {
        res.redirect("/admin-error")
    }
};

const getUnlistCategory = async (req, res) => {

    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect("/admin/category");
    } catch (error) {
        res.redirect("/admin-error")
    }
};

const getEditCategory = async (req, res) => {


    try {
        let id = req.query.id;
        const category = await Category.findOne({ _id: id });
        res.render("edit-category", { category: category })
    }
    catch (error) {
        res.redirect("/admin-error");
    }

}

module.exports = {

    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
}