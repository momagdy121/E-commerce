import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a product title'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a product description']
  },
  images: [{
    type: String,
    required: true
  }],
  price: {
    type: Number,
    required: [true, 'Please provide a product price'],
    min: 0
  },
  discountPrice: {
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        return value <= this.price;
      },
      message: 'Discount price must be less than or equal to regular price'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Please provide stock quantity'],
    min: 0,
    default: 0
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please provide a category']
  },
  brand: {
    type: String,
    trim: true
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  metaData: {
    color: [String],
    size: [String],
    tags: [String],
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
productSchema.index({ categoryId: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ price: 1 });
productSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);

