import Notification from '../models/Notification.js';
import { sendEmail } from './emailService.js';
import twilio from 'twilio';

// Firebase push notifications are disabled (not implemented yet)

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
  if (sendSMS) {
    if (twilioClient) {
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
    } else {
      console.warn('Twilio not configured. SMS not sent.');
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SMS MOCK] To: ${userId} | Message: ${title}: ${message}`);
      }
    }
  }

  // Push notification (Firebase) - not implemented yet
  // if (sendPush) {
  //   // TODO: Implement push notifications with Firebase
  // }

  return notification;
};
