const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new Schema({
   userId: { 
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true 
   },
   balance: {
      type: Number,
      default: 0
   },
   transactions: [
       {
           transactionType: {  
              type: String,
              enum: ['credit', 'debit'],
              required: true
           },
           amount: {
              type: Number,
              required: true
           },
           description: {
              type: String
           },
           status: {
              type: String,
              enum: ['Pending', 'Completed', 'Failed'],
              default: 'Completed'
           },
           createdAt: {
              type: Date,
              default: Date.now
           },
           orderId:{
            type:String,
            required:false,
           }   
       }
   ]
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
