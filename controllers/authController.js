import User from '../models/User.js';
import { generateToken, generateRefreshToken } from '../utils/generateToken.js';
import { sendEmail } from '../utils/emailService.js';
import { sendNotification } from '../utils/notificationService.js';
import { catchAsync, sendResponse } from '../utils/index.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../errors/index.js';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = catchAsync(async (req, res, next) => {
  const { fullName, email, password, phone } = req.body;

  // Check if user exists
  const query = [];
  if (email) query.push({ email });
  if (phone) query.push({ phone });

  if (query.length > 0) {
    const userExists = await User.findOne({ $or: query });
    if (userExists) {
      return next(new BadRequestError('An account with this email or phone already exists. Please log in.'));
    }
  }

  // Create user
  const user = await User.create({
    fullName,
    email,
    passwordHash: password,
    phone
  });

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP
  const otpHash = crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');

  user.otpCode = otpHash;
  user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 mins
  await user.save();

  // Send OTP
  if (email) {
    try {
      await sendEmail({
        email: user.email,
        subject: 'Verification Code',
        message: `Your verification code is: ${otp}. It expires in 10 minutes.`
      });
    } catch (err) {
      console.error('Failed to send verification email:', err);
    }
  } else if (phone) {
    try {
      await sendNotification({
        userId: user._id,
        type: 'verification',
        title: 'Verification Code',
        message: `Your verification code is: ${otp}. It expires in 10 minutes.`,
        sendSMS: true
      });
    } catch (err) {
      console.error('Failed to send SMS:', err);
    }
  }

  // Generate token
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  sendResponse(res, {
    code: 201,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified
      },
      token,
      refreshToken
    }
  });
});

// @desc    Verify OTP (Email or Phone)
// @route   POST /api/auth/verify-code
// @access  Public
export const verifyCode = catchAsync(async (req, res, next) => {
  const { email, phone, otp } = req.body;

  if ((!email && !phone) || !otp) {
    return next(new BadRequestError('To verify your account, please provide your contact info and the code we sent.'));
  }

  let user;
  if (email) {
    user = await User.findOne({ email }).select('+otpCode');
  } else if (phone) {
    user = await User.findOne({ phone }).select('+otpCode');
  }

  if (!user) {
    return next(new UnauthorizedError('We couldn\'t find a pending verification for these details.'));
  }

  if (email && user.isEmailVerified) {
    return next(new BadRequestError('Your email is already verified.'));
  }
  if (phone && user.isPhoneVerified) {
    return next(new BadRequestError('Your phone number is already verified.'));
  }

  if (!user.otpCode || !user.otpExpire) {
    return next(new BadRequestError('The verification code is missing or has expired. Please request a new one.'));
  }

  if (Date.now() > user.otpExpire) {
    return next(new BadRequestError('This verification code has expired. Please request a new one.'));
  }

  // Verify OTP
  const isMatch = crypto
    .createHash('sha256')
    .update(otp.toString())
    .digest('hex') === user.otpCode;

  if (!isMatch) {
    return next(new UnauthorizedError('The code you entered is incorrect. Please try again.'));
  }

  // Clear OTP and verify
  if (email) user.isEmailVerified = true;
  if (phone) user.isPhoneVerified = true;

  user.otpCode = undefined;
  user.otpExpire = undefined;
  await user.save();

  sendResponse(res, {
    message: 'Verification successful'
  });
});

// @desc    Resend OTP
// @route   POST /api/auth/resend-code
// @access  Public
export const resendCode = catchAsync(async (req, res, next) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    return next(new BadRequestError('Please provide your registered email or phone number.'));
  }

  let user;
  if (email) {
    user = await User.findOne({ email });
  } else {
    user = await User.findOne({ phone });
  }

  if (!user) {
    return next(new NotFoundError('We couldn\'t find an account matching these details.'));
  }

  if (email && user.isEmailVerified) {
    return next(new BadRequestError('Email is already verified'));
  }
  if (phone && user.isPhoneVerified) {
    return next(new BadRequestError('Phone is already verified'));
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP
  const otpHash = crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');

  user.otpCode = otpHash;
  user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 mins
  await user.save();

  // Send OTP
  if (email) {
    try {
      await sendEmail({
        email: user.email,
        subject: 'Verification Code',
        message: `Your verification code is: ${otp}. It expires in 10 minutes.`
      });
    } catch (error) {
      user.otpCode = undefined;
      user.otpExpire = undefined;
      await user.save();
      return next(new Error('Email could not be sent'));
    }
  } else {
    try {
      await sendNotification({
        userId: user._id,
        type: 'verification',
        title: 'Verification Code',
        message: `Your verification code is: ${otp}. It expires in 10 minutes.`,
        sendSMS: true
      });
    } catch (err) {
      console.error('Failed to send SMS:', err);
      // Don't fail the request if SMS fails, but log it
    }
  }

  sendResponse(res, {
    message: 'Verification code sent successfully'
  });
});

// @desc    Add Email
// @route   POST /api/auth/add-email
// @access  Private
export const addEmail = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const userId = req.user.id; // From verify token middleware

  if (!email) {
    return next(new BadRequestError('Please provide email'));
  }

  // Check if email taken
  const emailExists = await User.findOne({ email });
  if (emailExists) {
    return next(new BadRequestError('Email already in use'));
  }

  const user = await User.findById(userId);
  if (user.email) {
    return next(new BadRequestError('User already has an email'));
  }

  user.email = email;
  user.isEmailVerified = false;

  // Generate OTP immediately to verify
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  user.otpCode = otpHash;
  user.otpExpire = Date.now() + 10 * 60 * 1000;

  await user.save();

  try {
    await sendEmail({
      email: user.email,
      subject: 'Verification Code',
      message: `Your verification code is: ${otp}. It expires in 10 minutes.`
    });
  } catch (err) {
    console.error(err);
  }

  sendResponse(res, {
    message: 'Email added. Please verify.'
  });
});

// @desc    Add Phone
// @route   POST /api/auth/add-phone
// @access  Private
export const addPhone = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  const userId = req.user.id;

  if (!phone) {
    return next(new BadRequestError('Please provide phone'));
  }

  const phoneExists = await User.findOne({ phone });
  if (phoneExists) {
    return next(new BadRequestError('Phone already in use'));
  }

  const user = await User.findById(userId);
  if (user.phone) {
    return next(new BadRequestError('User already has a phone number'));
  }

  user.phone = phone;
  user.isPhoneVerified = false;

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  user.otpCode = otpHash;
  user.otpExpire = Date.now() + 10 * 60 * 1000;

  await user.save();

  try {
    await sendNotification({
      userId: user._id,
      type: 'verification',
      title: 'Verification Code',
      message: `Your verification code is: ${otp}. It expires in 10 minutes.`,
      sendSMS: true
    });
  } catch (err) {
    console.error('Failed to send SMS:', err);
  }

  sendResponse(res, {
    message: 'Phone added. Please verify.'
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = catchAsync(async (req, res, next) => {
  const { email, password, phone } = req.body;

  // Validate email/phone & password
  if ((!email && !phone) || !password) {
    return next(new BadRequestError('Please provide email/phone and password'));
  }

  // Check for user
  let user;
  if (email) {
    user = await User.findOne({ email }).select('+passwordHash');
  } else if (phone) {
    user = await User.findOne({ phone }).select('+passwordHash');
  }

  if (!user) {
    return next(new UnauthorizedError('The email or password you entered is incorrect.'));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new UnauthorizedError('The email or password you entered is incorrect.'));
  }

  // Generate token
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  sendResponse(res, {
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken
    }
  });
});

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new BadRequestError('Refresh token is required'));
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  const user = await User.findById(decoded.id);

  if (!user || user.refreshToken !== refreshToken) {
    return next(new UnauthorizedError('Your session has expired. Please log in again.'));
  }

  const newToken = generateToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshToken = newRefreshToken;
  await user.save();

  sendResponse(res, {
    message: 'Token refreshed successfully',
    data: {
      token: newToken,
      refreshToken: newRefreshToken
    }
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  user.refreshToken = null;
  user.lastLogoutAt = Date.now();

  await user.save();

  sendResponse(res, {
    message: 'Logged out successfully'
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new NotFoundError('We couldn\'t find a user with that email address.'));
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save({ validateBeforeSave: false });

  // Send email
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Password Reset Request',
      message: `You requested a password reset. Please click the link: ${resetUrl}`
    });

    sendResponse(res, {
      message: 'Password reset email sent successfully'
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new BadRequestError('Email could not be sent'));
  }
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
export const resetPassword = catchAsync(async (req, res, next) => {
  const { password } = req.body;
  const resetToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new BadRequestError('Invalid or expired token'));
  }

  // Set new password
  user.passwordHash = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendResponse(res, {
    message: 'Password reset successful'
  });
});


// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
export const googleCallback = catchAsync(async (req, res, next) => {
  const user = req.user;

  if (!user) {
    return next(new UnauthorizedError('Google authentication failed'));
  }

  // Generate token
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  // Redirect to frontend with tokens
  const frontendUrl = process.env.FRONTEND_URL;

  // If no frontend URL (or it points to backend) and in development, return HTML with token
  const isDev = process.env.NODE_ENV && process.env.NODE_ENV.trim() === 'development';
  const isLocalhost = !frontendUrl || frontendUrl.includes('localhost');

  if (isDev && isLocalhost) {
    return res.send(`
      <html>
        <body>
          <h1>Google Login Successful</h1>
          <p>Since no frontend is connected, here are your tokens:</p>
          <p><strong>Token:</strong> <br><textarea cols="100" rows="5">${token}</textarea></p>
          <p><strong>Refresh Token:</strong> <br><textarea cols="100" rows="2">${refreshToken}</textarea></p>
        </body>
      </html>
    `);
  }

  const redirectUrl = `${frontendUrl || 'http://localhost:3000'}/auth/callback?token=${token}&refreshToken=${refreshToken}`;

  res.redirect(redirectUrl);
});


