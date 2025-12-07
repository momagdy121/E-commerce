# E-Commerce Backend API

A scalable, secure, and maintainable backend for an e-commerce mobile/web application built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with refresh tokens, role-based access control, password reset, and social login support
- **User Management**: Profile management, address management, order history
- **Product Management**: CRUD operations, search, pagination, filtering, stock management
- **Category Management**: Tree-structured categories with hierarchical support
- **Shopping Cart**: Persistent cart with guest cart merge functionality
- **Wishlist**: Add/remove products to wishlist
- **Order Management**: Order creation, status tracking, coupon support, stock reduction
- **Payment Integration**: Stripe, PayPal, and Cash on Delivery (COD) support
- **Reviews & Ratings**: Product reviews with aggregated ratings
- **Notifications**: Email, SMS (Twilio), and Push (Firebase) notifications
- **Admin Dashboard**: Comprehensive admin panel with analytics and management tools

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance like MongoDB Atlas)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd E-commer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your configuration values.

4. **Start MongoDB**
   Make sure MongoDB is running on your system or use a cloud instance.

5. **Run the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📁 Project Structure

```
E-commer/
├── config/
│   └── database.js          # MongoDB connection
├── controllers/             # Business logic
│   ├── adminController.js
│   ├── authController.js
│   ├── cartController.js
│   ├── categoryController.js
│   ├── notificationController.js
│   ├── orderController.js
│   ├── paymentController.js
│   ├── productController.js
│   ├── reviewController.js
│   ├── userController.js
│   └── wishlistController.js
├── middleware/              # Custom middleware
│   ├── auth.js             # Authentication & authorization
│   ├── errorHandler.js     # Error handling
│   ├── notFound.js         # 404 handler
│   ├── rateLimiter.js      # Rate limiting
│   └── validators/         # Request validation
│       └── authValidator.js
├── models/                  # MongoDB models
│   ├── Cart.js
│   ├── Category.js
│   ├── Coupon.js
│   ├── Notification.js
│   ├── Order.js
│   ├── Payment.js
│   ├── Product.js
│   ├── Review.js
│   ├── User.js
│   └── Wishlist.js
├── routes/                  # API routes
│   ├── admin.js
│   ├── auth.js
│   ├── cart.js
│   ├── categories.js
│   ├── notifications.js
│   ├── orders.js
│   ├── payments.js
│   ├── products.js
│   ├── reviews.js
│   ├── users.js
│   └── wishlist.js
├── utils/                   # Utility functions
│   ├── emailService.js
│   ├── generateToken.js
│   └── notificationService.js
├── server.js                # Main server file
├── package.json
└── README.md
```

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Request password reset
- `PUT /api/auth/reset-password/:token` - Reset password
- `POST /api/auth/social-login` - Social login (Google/Facebook)
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/addresses` - Add address
- `PUT /api/users/addresses/:id` - Update address
- `DELETE /api/users/addresses/:id` - Remove address
- `PUT /api/users/change-password` - Change password
- `GET /api/users/orders` - Get order history
- `GET /api/users/orders/:id` - Get single order

### Products
- `GET /api/products` - Get all products (with filters, pagination)
- `GET /api/products/featured` - Get featured products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin/Vendor)
- `PUT /api/products/:id` - Update product (Admin/Vendor)
- `DELETE /api/products/:id` - Delete product (Admin)
- `PUT /api/products/:id/stock` - Update stock (Admin/Vendor)

### Categories
- `GET /api/categories` - Get all categories (tree structure)
- `GET /api/categories/:id` - Get single category
- `GET /api/categories/:id/products` - Get products by category
- `POST /api/categories` - Create category (Admin)
- `PUT /api/categories/:id` - Update category (Admin)
- `DELETE /api/categories/:id` - Delete category (Admin)

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/:id` - Update cart item quantity
- `DELETE /api/cart/items/:id` - Remove item from cart
- `DELETE /api/cart` - Clear cart
- `POST /api/cart/merge` - Merge guest cart

### Wishlist
- `GET /api/wishlist` - Get user wishlist
- `GET /api/wishlist/check/:productId` - Check if product in wishlist
- `POST /api/wishlist/products/:productId` - Add to wishlist
- `DELETE /api/wishlist/products/:productId` - Remove from wishlist

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id/cancel` - Cancel order
- `PUT /api/orders/:id/status` - Update order status (Admin)
- `GET /api/orders/admin/all` - Get all orders (Admin)

### Payments
- `POST /api/payments/create-intent` - Create Stripe payment intent
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/paypal/create` - Create PayPal payment
- `POST /api/payments/paypal/execute` - Execute PayPal payment
- `POST /api/payments/cod` - Process COD payment
- `POST /api/payments/webhook/stripe` - Stripe webhook handler
- `GET /api/payments/:id` - Get payment details

### Reviews
- `GET /api/reviews/product/:productId` - Get product reviews
- `GET /api/reviews/user` - Get user reviews
- `POST /api/reviews` - Add review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Admin
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/analytics/daily-sales` - Get daily sales
- `GET /api/admin/analytics/monthly-revenue` - Get monthly revenue
- `GET /api/admin/analytics/top-products` - Get top selling products
- `GET /api/admin/analytics/active-customers` - Get active customers
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/role` - Update user role
- `GET /api/admin/coupons` - Get all coupons
- `POST /api/admin/coupons` - Create coupon
- `PUT /api/admin/coupons/:id` - Update coupon
- `DELETE /api/admin/coupons/:id` - Delete coupon

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt for password encryption
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Express-validator for request validation
- **MongoDB Sanitization**: Protection against NoSQL injection
- **Helmet**: Security headers
- **CORS**: Configurable cross-origin resource sharing

## 📊 Database Schema

### Users
- id, fullName, email, passwordHash, phone, role, addresses[], preferences, createdAt

### Products
- id, title, description, images[], price, discountPrice, stock, categoryId, brand, rating, metaData, createdAt

### Categories
- id, name, parentCategoryId, slug, description, image, isActive

### Cart
- userId, items[], totalPrice, updatedAt

### Wishlist
- userId, productIds[]

### Orders
- id, userId, items[], totalPrice, discount, couponCode, paymentStatus, orderStatus, shippingAddress, trackingNumber, createdAt

### Reviews
- userId, productId, rating, comment, isVerifiedPurchase

### Payments
- orderId, userId, amount, method, transactionId, status, paymentIntentId, paypalPaymentId

## 🧪 Testing

```bash
npm test
```

## 📝 Environment Variables

See `.env.example` for all required environment variables.

Key variables:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `STRIPE_SECRET_KEY` - Stripe API key
- `PAYPAL_CLIENT_ID` - PayPal client ID
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` - Email configuration
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - Twilio credentials (for SMS)
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY` - Firebase credentials (for push notifications)

## 🚀 Deployment

1. Set all environment variables in your hosting platform
2. Ensure MongoDB is accessible
3. Build and start the application:
   ```bash
   npm start
   ```

## 📄 License

ISC

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For support, email your-email@example.com or open an issue in the repository.

---

Built with ❤️ using Node.js, Express, and MongoDB

