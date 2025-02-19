const Category=require("../models/categorySchema");
const Product =require("../models/productSchema");


const applyBestOffer = async () => {
    try {
  
        const categories = await Category.find({}, "_id categoryOffer expiredOn");


        const categoryOfferMap = categories.reduce((map, category) => {
            const isExpired = category.expiredOn && category.expiredOn < Date.now();
            map[category._id.toString()] = isExpired ? 0 : category.categoryOffer || 0;
            return map;
        }, {});


        const products = await Product.find({}, "_id category regularPrice productOffer offerExpiry");

  
        const bulkUpdates = products.map(product => {
            const categoryOffer = categoryOfferMap[product.category.toString()] || 0;
            const productOffer = product.productOffer || 0;
            const offerExpiry = product.offerExpiry && product.offerExpiry < Date.now() ? 0 : productOffer;

            const bestOffer = Math.max(categoryOffer, offerExpiry);
            const discountAmount = (product.regularPrice * bestOffer) / 100;
            const discountedPrice = Math.round(product.regularPrice - discountAmount);

            return {
                updateOne: {
                    filter: { _id: product._id },
                    update: { 
                        finalOffer: bestOffer,
                        salePrice: discountedPrice 
                    }
                }
            };
        });

        
        if (bulkUpdates.length > 0) {
            await Product.bulkWrite(bulkUpdates);
        }
    } catch (error) {
        console.error("Error applying best offer:", error);
    }
};

module.exports={applyBestOffer};