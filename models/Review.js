import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Please provide a rating'],
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// One review per user per product
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Index for better query performance
reviewSchema.index({ productId: 1 });
reviewSchema.index({ rating: -1 });

export default mongoose.model('Review', reviewSchema);

