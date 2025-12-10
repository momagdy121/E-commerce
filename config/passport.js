import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import { generateToken, generateRefreshToken } from '../utils/generateToken.js';

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy (only register if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Check if user exists with this Google ID
                    let user = await User.findOne({ googleId: profile.id });

                    if (user) {
                        // User exists, return user
                        return done(null, user);
                    }

                    // Check if user exists with this email
                    user = await User.findOne({ email: profile.emails[0].value });

                    if (user) {
                        // User exists but doesn't have Google ID, link it
                        user.googleId = profile.id;
                        user.provider = 'google';
                        user.isEmailVerified = true;
                        await user.save();
                        return done(null, user);
                    }

                    // Create new user
                    user = await User.create({
                        fullName: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
                        email: profile.emails[0].value,
                        googleId: profile.id,
                        provider: 'google',
                        isEmailVerified: true,
                        passwordHash: undefined // No password for OAuth users
                    });

                    return done(null, user);
                } catch (error) {
                    return done(error, null);
                }
            }
        )
    );
} else {
    console.log('⚠️  Google OAuth credentials not found. Google login will be disabled.');
}

export default passport;
