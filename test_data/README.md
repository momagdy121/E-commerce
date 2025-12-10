# Test Data for E-Commerce API

This folder contains sample test data in CSV format that can be imported into MongoDB for testing purposes.

## Files

| File | Description | Records |
|------|-------------|---------|
| `categories.csv` | Product categories | 12 |
| `users.csv` | User accounts (customers, admins, vendors) | 10 |
| `products.csv` | Sample products with prices and metadata | 15 |
| `coupons.csv` | Discount coupons with various types | 10 |
| `reviews.csv` | Product reviews from users | 15 |
| `orders.csv` | Sample orders in various statuses | 10 |
| `wishlists.csv` | User wishlists (favorites) | 9 |
| `carts.csv` | Shopping cart items | 15 |
| `notifications.csv` | User notifications | 14 |
| `payments.csv` | Payment transactions | 10 |

## Importing Data

### Using the Seed Script

Run the seed script to automatically import all data:

```bash
node test_data/seed.js
```

> ⚠️ **Warning**: This will clear all existing data before importing!

### Test User Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@ecommerce.com | AdminPass789! | Admin |
| alice.j@example.com | AliceSecure!1 | Vendor |
| tom.garcia@example.com | TomPass789! | Vendor |
| john.smith@example.com | Password123! | User |
| jane.doe@example.com | SecurePass456! | User |

### Sample Coupon Codes

| Code | Discount | Min Purchase |
|------|----------|--------------|
| WELCOME10 | 10% off | $50 |
| SAVE20 | 20% off | $100 |
| FLAT50 | $50 off | $200 |
| HOLIDAY30 | 30% off | $200 |
| FREESHIP | Free shipping ($15) | $50 |

## Opening as Excel

These CSV files can be opened directly in Microsoft Excel or Google Sheets.
Simply double-click any `.csv` file or use File > Open in Excel.
