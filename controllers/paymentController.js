import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import Stripe from 'stripe';
import paypal from 'paypal-rest-sdk';
import { sendNotification } from '../utils/notificationService.js';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import { catchAsync, sendResponse } from '../utils/index.js';

// Initialize Stripe (only if credentials are provided)
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.log('⚠️  Stripe credentials not found. Stripe payments will be disabled.');
}

// Configure PayPal (only if credentials are provided)
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  paypal.configure({
    mode: process.env.PAYPAL_MODE || 'sandbox',
    client_id: process.env.PAYPAL_CLIENT_ID,
    client_secret: process.env.PAYPAL_CLIENT_SECRET
  });
} else {
  console.log('⚠️  PayPal credentials not found. PayPal payments will be disabled.');
}

// @desc    Create payment intent (Stripe)
// @route   POST /api/payments/create-intent
// @access  Private
export const createPaymentIntent = catchAsync(async (req, res, next) => {
  const { orderId, amount } = req.body;

  const order = await Order.findOne({
    _id: orderId,
    userId: req.user.id
  });

  if (!order) {
    return next(new NotFoundError('Order not found'));
  }

  if (order.paymentStatus === 'paid') {
    return next(new BadRequestError('Order is already paid'));
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    metadata: {
      orderId: orderId.toString(),
      userId: req.user.id.toString()
    }
  });

  // Update payment record
  const payment = await Payment.findOne({ orderId });
  if (payment) {
    payment.paymentIntentId = paymentIntent.id;
    payment.status = 'processing';
    await payment.save();
  }

  sendResponse(res, {
    message: 'Payment intent created successfully',
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    }
  });
});

// @desc    Verify payment (Stripe)
// @route   POST /api/payments/verify
// @access  Private
export const verifyPayment = catchAsync(async (req, res, next) => {
  const { paymentIntentId } = req.body;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status === 'succeeded') {
    const payment = await Payment.findOne({ paymentIntentId });
    if (payment) {
      payment.status = 'completed';
      payment.transactionId = paymentIntent.id;
      await payment.save();

      const order = await Order.findById(payment.orderId);
      if (order) {
        order.paymentStatus = 'paid';
        await order.save();

        // Send notification
        await sendNotification({
          userId: order.userId,
          type: 'payment_successful',
          title: 'Payment Successful',
          message: `Your payment for order #${order._id} was successful`,
          data: { orderId: order._id }
        });
      }
    }

    sendResponse(res, {
      message: 'Payment verified successfully'
    });
  } else {
    return next(new BadRequestError('Payment not completed'));
  }
});

// @desc    Create PayPal payment
// @route   POST /api/payments/paypal/create
// @access  Private
export const createPayPalPayment = catchAsync(async (req, res, next) => {
  const { orderId, amount } = req.body;

  const order = await Order.findOne({
    _id: orderId,
    userId: req.user.id
  });

  if (!order) {
    return next(new NotFoundError('Order not found'));
  }

  const create_payment_json = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal'
    },
    redirect_urls: {
      return_url: `${process.env.FRONTEND_URL}/payment/success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
    },
    transactions: [{
      item_list: {
        items: order.items.map(item => ({
          name: item.title,
          sku: item.productId.toString(),
          price: item.price.toFixed(2),
          currency: 'USD',
          quantity: item.quantity
        }))
      },
      amount: {
        currency: 'USD',
        total: amount.toFixed(2)
      },
      description: `Order #${orderId}`
    }]
  };

  paypal.payment.create(create_payment_json, async (error, payment) => {
    if (error) {
      return next(new BadRequestError(error.message));
    }

    // Update payment record
    const paymentRecord = await Payment.findOne({ orderId });
    if (paymentRecord) {
      paymentRecord.paypalPaymentId = payment.id;
      paymentRecord.status = 'processing';
      await paymentRecord.save();
    }

    // Find approval URL
    const approvalUrl = payment.links.find(link => link.rel === 'approval_url');

    sendResponse(res, {
      message: 'PayPal payment created successfully',
      data: {
        paymentId: payment.id,
        approvalUrl: approvalUrl.href
      }
    });
  });
});

// @desc    Execute PayPal payment
// @route   POST /api/payments/paypal/execute
// @access  Private
export const executePayPalPayment = catchAsync(async (req, res, next) => {
  const { paymentId, payerId } = req.body;

  const execute_payment_json = {
    payer_id: payerId
  };

  paypal.payment.execute(paymentId, execute_payment_json, async (error, payment) => {
    if (error) {
      return next(new BadRequestError(error.message));
    }

    if (payment.state === 'approved') {
      const paymentRecord = await Payment.findOne({ paypalPaymentId: paymentId });
      if (paymentRecord) {
        paymentRecord.status = 'completed';
        paymentRecord.transactionId = payment.id;
        await paymentRecord.save();

        const order = await Order.findById(paymentRecord.orderId);
        if (order) {
          order.paymentStatus = 'paid';
          await order.save();

          // Send notification
          await sendNotification({
            userId: order.userId,
            type: 'payment_successful',
            title: 'Payment Successful',
            message: `Your payment for order #${order._id} was successful`,
            data: { orderId: order._id }
          });
        }
      }

      sendResponse(res, {
        message: 'Payment executed successfully',
        data: payment
      });
    } else {
      return next(new BadRequestError('Payment not approved'));
    }
  });
});

// @desc    Handle Stripe webhook
// @route   POST /api/payments/webhook/stripe
// @access  Public
export const handleStripeWebhook = catchAsync(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const payment = await Payment.findOne({ paymentIntentId: paymentIntent.id });
      if (payment) {
        payment.status = 'completed';
        payment.transactionId = paymentIntent.id;
        await payment.save();

        const order = await Order.findById(payment.orderId);
        if (order) {
          order.paymentStatus = 'paid';
          await order.save();
        }
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object;
      const failedPayment = await Payment.findOne({
        paymentIntentId: failedPaymentIntent.id
      });
      if (failedPayment) {
        failedPayment.status = 'failed';
        await failedPayment.save();
      }
      break;

    case 'charge.refunded':
      const refund = event.data.object;
      // Handle refund logic
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// @desc    Get payment details
// @route   GET /api/payments/:paymentId
// @access  Private
export const getPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findOne({
    _id: req.params.paymentId,
    userId: req.user.id
  }).populate('orderId');

  if (!payment) {
    return next(new NotFoundError('Payment not found'));
  }

  sendResponse(res, {
    message: 'Payment retrieved successfully',
    data: payment
  });
});

// @desc    Process COD payment
// @route   POST /api/payments/cod
// @access  Private
export const processCOD = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  const order = await Order.findOne({
    _id: orderId,
    userId: req.user.id
  });

  if (!order) {
    return next(new NotFoundError('Order not found'));
  }

  if (order.paymentMethod !== 'COD') {
    return next(new BadRequestError('Order is not COD'));
  }

  // For COD, payment is pending until delivery
  const payment = await Payment.findOne({ orderId });
  if (payment) {
    payment.status = 'pending';
    await payment.save();
  }

  sendResponse(res, {
    message: 'COD order confirmed. Payment will be collected on delivery.'
  });
});
