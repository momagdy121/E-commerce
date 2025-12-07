# Utility Functions

This directory contains reusable utility functions for the e-commerce backend.

## Available Utilities

### 1. `sendResponse.js`
Standardized API response handler.

**Usage:**
```javascript
import sendResponse from '../utils/sendResponse.js';

// Success response
sendResponse(res, {
  status: 'success',
  code: 200,
  message: 'Products retrieved successfully',
  data: { products },
  meta: { pagination }
});

// Error response
sendResponse(res, {
  status: 'error',
  code: 404,
  message: 'Product not found'
});
```

### 2. `catchAsync.js`
Wrapper to catch errors in async route handlers.

**Usage:**
```javascript
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';

export const getProducts = catchAsync(async (req, res, next) => {
  const products = await Product.find();
  sendResponse(res, { data: products });
  // No need for try-catch!
});
```

### 3. `apiFeatures.js`
Advanced query processing with pagination, filtering, sorting, etc.

**Usage:**
```javascript
import ApiFeatures from '../utils/apiFeatures.js';
import sendResponse from '../utils/sendResponse.js';

export const getProducts = catchAsync(async (req, res, next) => {
  const features = new ApiFeatures(Product.find({ isActive: true }), req.query)
    .filter()
    .sort()
    .paginate()
    .limitFields()
    .populate('categoryId');

  const products = await features.query;
  const total = await Product.countDocuments(features.query.getQuery());
  const pagination = await ApiFeatures.getPaginationMeta(
    Product.find({ isActive: true }),
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    data: products,
    meta: pagination
  });
});
```

**Query Parameters:**
- `?page=2` - Page number
- `?limit=20` - Items per page
- `?sort=-price,name` - Sort by price (desc), then name (asc)
- `?fields=name,price` - Select only specific fields
- `?search=laptop` - Search in title/description
- `?price[gte]=100&price[lte]=500` - Price range
- `?category=electronics` - Filter by category
- `?populate=categoryId` - Populate referenced fields

### 4. `queryProcessor.js`
Lower-level query processor with more control.

**Usage:**
```javascript
import QueryProcessor from '../utils/queryProcessor.js';

const processor = new QueryProcessor(Product.find(), req.query);
processor.filter().sort().selectFields();
const pagination = processor.paginate();
const { results } = await processor.execute();
```

## Combined Example

```javascript
import Product from '../models/Product.js';
import { catchAsync, sendResponse, ApiFeatures } from '../utils/index.js';

export const getProducts = catchAsync(async (req, res, next) => {
  const features = new ApiFeatures(Product.find({ isActive: true }), req.query)
    .filter()
    .sort()
    .paginate()
    .limitFields()
    .populate('categoryId');

  const products = await features.query;
  
  // Get total count for pagination
  const totalQuery = Product.find({ isActive: true });
  const total = await Product.countDocuments(totalQuery.getQuery());
  
  const pagination = ApiFeatures.getPaginationMeta(
    totalQuery,
    features.pagination.page,
    features.pagination.limit
  );

  sendResponse(res, {
    message: 'Products retrieved successfully',
    data: products,
    meta: pagination
  });
});
```

## Benefits

1. **Consistency**: All API responses follow the same structure
2. **Less Boilerplate**: No need for try-catch in every controller
3. **Reusability**: Query processing logic is centralized
4. **Maintainability**: Easy to update response format or query logic
5. **Type Safety**: Better IDE autocomplete and error detection

