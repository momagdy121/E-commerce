import Notification from '../models/Notification.js';
import { sendEmail } from './emailService.js';
import admin from 'firebase-admin';
import twilio from 'twilio';

// Initialize Firebase Admin (if configured)
let firebaseInitialized = false;
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    });
    firebaseInitialized = true;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
}

// Initialize Twilio (if configured)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Send notification
export const sendNotification = async (options) => {
  const { userId, type, title, message, data, sendEmail: shouldSendEmail, sendSMS, sendPush } = options;

  // Create notification in database
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    data
  });

  // Send email notification
  if (shouldSendEmail) {
    try {
      const User = (await import('../models/User.js')).default;
      const user = await User.findById(userId);
      if (user && user.email) {
        await sendEmail({
          email: user.email,
          subject: title,
          message: message
        });
      }
    } catch (error) {
      console.error('Email notification failed:', error);
    }
  }

  // Send SMS notification
  if (sendSMS && twilioClient) {
    try {
      const User = (await import('../models/User.js')).default;
      const user = await User.findById(userId);
      if (user && user.phone) {
        await twilioClient.messages.create({
          body: `${title}: ${message}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: user.phone
        });
      }
    } catch (error) {
      console.error('SMS notification failed:', error);
    }
  }

  // Send push notification
  if (sendPush && firebaseInitialized) {
    try {
      // This would require storing FCM tokens in user model
      // For now, this is a placeholder
      // const user = await User.findById(userId);
      // if (user && user.fcmToken) {
      //   await admin.messaging().send({
      //     token: user.fcmToken,
      //     notification: {
      //       title,
      //       body: message
      //     },
      //     data: data || {}
      //   });
      // }
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }

  return notification;
};
