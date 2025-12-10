import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Models
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Wishlist from '../models/Wishlist.js';
import Cart from '../models/Cart.js';
import Notification from '../models/Notification.js';
import Payment from '../models/Payment.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CSV helper function
const parseCSV = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        return obj;
    });
};

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
        console.log('✅ Connected to MongoDB');

        // Clear existing data (optional - comment out if you want to keep existing data)
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Category.deleteMany({});
        await Product.deleteMany({});
        await Coupon.deleteMany({});
        await Review.deleteMany({});
        await Order.deleteMany({});
        await Wishlist.deleteMany({});
        await Cart.deleteMany({});
        await Notification.deleteMany({});
        await Payment.deleteMany({});

        // Seed Categories
        console.log('📁 Seeding categories...');
        const categoriesData = parseCSV(path.join(__dirname, 'categories.csv'));
        const categories = await Category.insertMany(
            categoriesData.map(cat => ({
                name: cat.name,
                slug: cat.slug,
                description: cat.description,
                isActive: cat.isActive === 'true'
            }))
        );
        console.log(`   ✅ Created ${categories.length} categories`);

        // Create category lookup map
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.name] = cat._id;
        });

        // Seed Users
        console.log('👥 Seeding users...');
        const usersData = parseCSV(path.join(__dirname, 'users.csv'));
        const users = [];
        for (const userData of usersData) {
            const user = await User.create({
                fullName: userData.fullName,
                email: userData.email,
                passwordHash: userData.password, // Will be hashed by the pre-save hook
                phone: userData.phone,
                role: userData.role,
                addresses: [{
                    street: userData.street,
                    city: userData.city,
                    state: userData.state,
                    zipCode: userData.zipCode,
                    country: userData.country,
                    isDefault: true
                }],
                isEmailVerified: userData.isEmailVerified === 'true'
            });
            users.push(user);
        }
        console.log(`   ✅ Created ${users.length} users`);

        // Create user lookup map by email
        const userMap = {};
        users.forEach(user => {
            userMap[user.email] = user._id;
        });

        // Seed Products
        console.log('📦 Seeding products...');
        const productsData = parseCSV(path.join(__dirname, 'products.csv'));
        const products = await Product.insertMany(
            productsData.map(prod => ({
                title: prod.title,
                description: prod.description,
                price: parseFloat(prod.price),
                discountPrice: prod.discountPrice ? parseFloat(prod.discountPrice) : undefined,
                stock: parseInt(prod.stock) || 50,
                categoryId: categoryMap[prod.categoryName] || categories[0]._id,
                brand: prod.brand,
                images: prod.images ? prod.images.split('|') : ['https://via.placeholder.com/300'],
                metaData: {
                    color: prod.colors ? prod.colors.split('|') : [],
                    size: prod.sizes ? prod.sizes.split('|') : [],
                    tags: prod.tags ? prod.tags.split('|') : []
                },
                isActive: true
            }))
        );
        console.log(`   ✅ Created ${products.length} products`);

        // Create product lookup map by title
        const productMap = {};
        products.forEach(prod => {
            productMap[prod.title] = prod;
        });

        // Seed Coupons
        console.log('🎟️  Seeding coupons...');
        const couponsData = parseCSV(path.join(__dirname, 'coupons.csv'));
        const coupons = await Coupon.insertMany(
            couponsData.map(coupon => ({
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: parseFloat(coupon.discountValue),
                minPurchaseAmount: parseFloat(coupon.minPurchaseAmount) || 0,
                maxDiscountAmount: coupon.maxDiscountAmount ? parseFloat(coupon.maxDiscountAmount) : null,
                validFrom: new Date(coupon.validFrom),
                validUntil: new Date(coupon.validUntil),
                usageLimit: coupon.usageLimit ? parseInt(coupon.usageLimit) : null,
                isActive: coupon.isActive === 'true'
            }))
        );
        console.log(`   ✅ Created ${coupons.length} coupons`);

        // Seed Reviews
        console.log('⭐ Seeding reviews...');
        const reviewsData = parseCSV(path.join(__dirname, 'reviews.csv'));
        const reviews = [];
        for (const reviewData of reviewsData) {
            const userId = userMap[reviewData.userEmail];
            const product = productMap[reviewData.productTitle];

            if (userId && product) {
                const review = await Review.create({
                    userId,
                    productId: product._id,
                    rating: parseInt(reviewData.rating),
                    comment: reviewData.comment,
                    isVerifiedPurchase: reviewData.isVerifiedPurchase === 'true'
                });
                reviews.push(review);

                // Update product rating
                const productReviews = await Review.find({ productId: product._id });
                const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
                await Product.findByIdAndUpdate(product._id, {
                    'rating.average': Math.round(avgRating * 10) / 10,
                    'rating.count': productReviews.length
                });
            }
        }
        console.log(`   ✅ Created ${reviews.length} reviews`);

        // Seed Orders
        console.log('🛒 Seeding orders...');
        const ordersData = parseCSV(path.join(__dirname, 'orders.csv'));
        const orders = [];
        for (const orderData of ordersData) {
            const userId = userMap[orderData.userEmail];
            const product = productMap[orderData.productTitle];

            if (userId && product) {
                const order = await Order.create({
                    userId,
                    items: [{
                        productId: product._id,
                        title: product.title,
                        quantity: parseInt(orderData.quantity),
                        price: product.discountPrice || product.price,
                        image: product.images[0]
                    }],
                    totalPrice: parseFloat(orderData.totalPrice),
                    discount: parseFloat(orderData.discount) || 0,
                    couponCode: orderData.couponCode || undefined,
                    paymentStatus: orderData.paymentStatus,
                    orderStatus: orderData.orderStatus,
                    paymentMethod: orderData.paymentMethod,
                    shippingAddress: {
                        street: orderData.street,
                        city: orderData.city,
                        state: orderData.state,
                        zipCode: orderData.zipCode,
                        country: orderData.country
                    },
                    trackingNumber: orderData.trackingNumber || undefined,
                    notes: orderData.notes || undefined
                });
                orders.push(order);
            }
        }
        console.log(`   ✅ Created ${orders.length} orders`);

        // Seed Wishlists
        console.log('❤️  Seeding wishlists...');
        const wishlistsData = parseCSV(path.join(__dirname, 'wishlists.csv'));
        const wishlists = [];
        for (const wishlistData of wishlistsData) {
            const userId = userMap[wishlistData.userEmail];
            if (userId) {
                const productTitles = wishlistData.productTitles.split('|');
                const productIds = productTitles
                    .map(title => productMap[title]?._id)
                    .filter(id => id);

                if (productIds.length > 0) {
                    const wishlist = await Wishlist.create({
                        userId,
                        productIds
                    });
                    wishlists.push(wishlist);
                }
            }
        }
        console.log(`   ✅ Created ${wishlists.length} wishlists`);

        // Seed Carts
        console.log('🛍️  Seeding carts...');
        const cartsData = parseCSV(path.join(__dirname, 'carts.csv'));
        const cartsByUser = {};
        for (const cartData of cartsData) {
            const userId = userMap[cartData.userEmail];
            const product = productMap[cartData.productTitle];

            if (userId && product) {
                if (!cartsByUser[cartData.userEmail]) {
                    cartsByUser[cartData.userEmail] = {
                        userId,
                        items: []
                    };
                }
                cartsByUser[cartData.userEmail].items.push({
                    productId: product._id,
                    quantity: parseInt(cartData.quantity),
                    price: product.discountPrice || product.price
                });
            }
        }
        const carts = [];
        for (const cartData of Object.values(cartsByUser)) {
            try {
                const cart = await Cart.create(cartData);
                carts.push(cart);
            } catch (err) {
                console.error(`   ⚠️  Failed to create cart for user: ${err.message}`);
            }
        }
        console.log(`   ✅ Created ${carts.length} carts`);

        // Seed Notifications
        console.log('🔔 Seeding notifications...');
        const notificationsData = parseCSV(path.join(__dirname, 'notifications.csv'));
        const notifications = [];
        for (const notifData of notificationsData) {
            const userId = userMap[notifData.userEmail];
            if (userId) {
                const notification = await Notification.create({
                    userId,
                    type: notifData.type,
                    title: notifData.title,
                    message: notifData.message,
                    isRead: notifData.isRead === 'true'
                });
                notifications.push(notification);
            }
        }
        console.log(`   ✅ Created ${notifications.length} notifications`);

        // Seed Payments
        console.log('💳 Seeding payments...');
        const paymentsData = parseCSV(path.join(__dirname, 'payments.csv'));
        const payments = [];
        for (const paymentData of paymentsData) {
            const userId = userMap[paymentData.userEmail];
            const orderIndex = parseInt(paymentData.orderIndex);
            const order = orders[orderIndex];

            if (userId && order) {
                const payment = await Payment.create({
                    orderId: order._id,
                    userId,
                    amount: parseFloat(paymentData.amount),
                    method: paymentData.method,
                    transactionId: paymentData.transactionId || undefined,
                    status: paymentData.status
                });
                payments.push(payment);

                // Link payment to order
                await Order.findByIdAndUpdate(order._id, { paymentId: payment._id });
            }
        }
        console.log(`   ✅ Created ${payments.length} payments`);

        console.log('\n🎉 Database seeding completed successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Categories:    ${categories.length}`);
        console.log(`   Users:         ${users.length}`);
        console.log(`   Products:      ${products.length}`);
        console.log(`   Coupons:       ${coupons.length}`);
        console.log(`   Reviews:       ${reviews.length}`);
        console.log(`   Orders:        ${orders.length}`);
        console.log(`   Wishlists:     ${wishlists.length}`);
        console.log(`   Carts:         ${carts.length}`);
        console.log(`   Notifications: ${notifications.length}`);
        console.log(`   Payments:      ${payments.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
