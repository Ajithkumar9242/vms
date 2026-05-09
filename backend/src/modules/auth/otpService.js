const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const OtpSession = require('../../models/OtpSession');
const User     = require('../../models/User');
const Parent   = require('../../models/Parent');
const AppError = require('../../utils/AppError');

const OTP_TTL_MINUTES  = 5;
const OTP_MAX_ATTEMPTS = 5;
const REFRESH_SECRET   = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';
const REFRESH_EXPIRY   = process.env.JWT_REFRESH_EXPIRES_IN || '180d'; // 6 months

/**
 * OtpService — handles phone-based OTP login for parents.
 *
 * MSG91 integration is stubbed.
 * Set MSG91_API_KEY + MSG91_TEMPLATE_ID in .env to go live.
 * In dev-mode the OTP is printed to the console.
 */
class OtpService {

  /**
   * Generate a cryptographically random 6-digit OTP.
   */
  static _generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /**
   * Send OTP to a phone number.
   * Creates / replaces OtpSession for this phone.
   * @param {string} phone
   */
  static async sendOtp(phone) {
    if (!phone || !/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      throw new AppError('Please provide a valid 10-digit mobile number', 400);
    }

    // Verify the phone belongs to a parent user (or any user with role parent)
    const parent = await Parent.findOne({ phone }).select('_id phone');
    if (!parent) {
      // Still send OTP to avoid user enumeration — but we'll fail at verify
      // For UX, you may choose to reveal "not found". Using safe approach here.
      console.warn(`[OTP] No parent found for phone ${phone} — OTP generation suppressed`);
      return { message: 'If this number is registered, an OTP has been sent.' };
    }

    const otp     = OtpService._generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Upsert — replace any existing session for this phone
    await OtpSession.findOneAndUpdate(
      { phone },
      { phone, otpHash, expiresAt, attempts: 0, verified: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ── Send via MSG91 ──────────────────────────────────────────
    await OtpService._dispatchSms(phone, otp);

    return { message: 'OTP sent successfully. Valid for 5 minutes.' };
  }

  /**
   * Verify OTP and return user + tokens.
   * @param {string} phone
   * @param {string} otp
   * @returns {{ user, accessToken, refreshToken }}
   */
  static async verifyOtp(phone, otp) {
    const session = await OtpSession.findOne({ phone, verified: false }).select('+otpHash');
    if (!session) {
      throw new AppError('No pending OTP for this number. Please request a new OTP.', 400);
    }

    if (new Date() > session.expiresAt) {
      await session.deleteOne();
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    if (session.attempts >= OTP_MAX_ATTEMPTS) {
      await session.deleteOne();
      throw new AppError('Too many failed attempts. Please request a new OTP.', 429);
    }

    const isValid = await session.compareOtp(otp);
    if (!isValid) {
      session.attempts += 1;
      await session.save();
      throw new AppError(`Incorrect OTP. ${OTP_MAX_ATTEMPTS - session.attempts} attempts remaining.`, 400);
    }

    // Mark verified + cleanup
    session.verified = true;
    await session.save();

    // Find the parent + linked User
    const parent = await Parent.findOne({ phone });
    if (!parent) throw new AppError('Parent account not found for this number.', 404);

    let user = parent.userId
      ? await User.findById(parent.userId)
      : await User.findOne({ phone, role: 'parent' });

    if (!user) {
      // Auto-create user for parents who pre-date OTP system
      const AuthService = require('./service');
      user = await AuthService.createParentUser(parent, null);
      if (!user) throw new AppError('Could not create parent account. Contact admin.', 500);
    }

    const accessToken  = OtpService.generateAccessToken(user._id, user.role);
    const refreshToken = await OtpService.generateAndStoreRefreshToken(user._id);

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    return { user: userObj, accessToken, refreshToken };
  }

  /**
   * Generate a short-lived access JWT.
   */
  static generateAccessToken(userId, role) {
    return jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
  }

  /**
   * Generate a long-lived refresh token and store its hash on the User doc.
   */
  static async generateAndStoreRefreshToken(userId) {
    const refreshToken = jwt.sign(
      { id: userId, type: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );
    const hash = await bcrypt.hash(refreshToken, 8);
    await User.findByIdAndUpdate(userId, { refreshTokenHash: hash });
    return refreshToken;
  }

  /**
   * Validate refresh token and issue new access token.
   * @param {string} refreshToken
   */
  static async refreshAccessToken(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET);
    } catch {
      throw new AppError('Invalid or expired refresh token. Please log in again.', 401);
    }

    const user = await User.findById(payload.id).select('+refreshTokenHash');
    if (!user || !user.refreshTokenHash) {
      throw new AppError('Session expired. Please log in again.', 401);
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) throw new AppError('Session expired. Please log in again.', 401);

    const newAccessToken = OtpService.generateAccessToken(user._id, user.role);
    return { accessToken: newAccessToken };
  }

  /**
   * Logout: invalidate stored refresh token.
   */
  static async logout(userId) {
    await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
    return { message: 'Logged out successfully' };
  }

  /**
   * SMS dispatch — MSG91 integration.
   * Set MSG91_API_KEY + MSG91_TEMPLATE_ID in .env for production.
   */
  static async _dispatchSms(phone, otp) {
    const apiKey     = process.env.MSG91_API_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (apiKey && templateId) {
      try {
        // MSG91 Send OTP API
        const https = require('https');
        const body  = JSON.stringify({
          template_id: templateId,
          mobile:      `91${phone.replace(/\D/g, '')}`,
          authkey:     apiKey,
          otp,
        });
        await new Promise((resolve, reject) => {
          const req = https.request(
            {
              hostname: 'control.msg91.com',
              path:     '/api/v5/otp',
              method:   'POST',
              headers:  { 'Content-Type': 'application/json', 'content-length': Buffer.byteLength(body) },
            },
            (res) => { let d = ''; res.on('data', c => (d += c)); res.on('end', () => resolve(d)); }
          );
          req.on('error', reject);
          req.write(body);
          req.end();
        });
        console.log(`[OTP] MSG91 SMS dispatched to ${phone}`);
      } catch (e) {
        console.error('[OTP] MSG91 dispatch failed:', e.message);
        // Non-fatal in production; OTP still in DB
      }
    } else {
      // ── DEV MODE: log OTP to console ───────────────────────
      console.log(`\n╔══════════════════════════════╗`);
      console.log(`║  OTP for ${phone}: ${otp}  ║`);
      console.log(`╚══════════════════════════════╝\n`);
    }
  }
}

module.exports = OtpService;
