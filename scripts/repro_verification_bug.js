import mongoose from 'mongoose';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';

// Manual Env Parsing
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim(); // Handle values with =
            if (key && !key.startsWith('#')) {
                process.env[key] = value;
            }
        }
    });
} else {
    console.error('.env file not found!');
    process.exit(1);
}

const run = async () => {
    try {
        console.log('MONGO_URI is:', process.env.MONGO_URI ? 'Defined' : 'UNDEFINED');

        // Handle potential quotes in env value
        let mongoUri = process.env.MONGO_URI;
        if (mongoUri.startsWith('"') && mongoUri.endsWith('"')) {
            mongoUri = mongoUri.slice(1, -1);
        }

        await mongoose.connect(mongoUri);
        console.log('Connected to DB');

        const testEmail = 'bugtest_' + Date.now() + '@example.com';
        const otp = '123456';

        console.log('Testing with email:', testEmail);

        // 1. Create User
        const crypto = await import('crypto');
        const otpHash = crypto.default.createHash('sha256').update(otp).digest('hex');

        const user = await User.create({
            fullName: 'Bug Test',
            email: testEmail,
            passwordHash: 'hashedpassword',
            otpCode: otpHash,
            otpExpire: Date.now() + 600000,
            isEmailVerified: false
        });
        console.log(`1. Created User. Verified: ${user.isEmailVerified}`);

        // 2. Simulate Verify
        let userToVerify = await User.findOne({ email: testEmail }).select('+otpCode');

        // Simulate Input (Assuming user sends matching email)
        const inputEmail = testEmail;

        // Logic from Controller
        if (inputEmail) userToVerify.isEmailVerified = true;

        userToVerify.otpCode = undefined;
        userToVerify.otpExpire = undefined;

        await userToVerify.save();
        console.log('2. Updates Saved.');

        // 3. Verify
        const freshUser = await User.findById(user._id);
        console.log(`3. Fetched User. Verified: ${freshUser.isEmailVerified}`);

        if (freshUser.isEmailVerified === true) {
            console.log('SUCCESS: isEmailVerified is TRUE. The code logic is correct.');
        } else {
            console.log('FAILURE: isEmailVerified is FALSE.');
        }

    } catch (err) {
        console.error('CRASH:', err);
    } finally {
        await mongoose.connection.close();
    }
};

run();
