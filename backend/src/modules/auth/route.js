const router = require('express').Router();
const AuthController = require('./controller');
const { protect } = require('../../middlewares/auth');
const { body, validate } = require('../../utils/validators');

// ─── Validation Rules ───────────────────────────────────────
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
];

// ─── Routes ─────────────────────────────────────────────────

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return token
 * @access  Public
 */
router.post('/login', loginValidation, AuthController.login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged-in user profile
 * @access  Private
 */
router.get('/me', protect, AuthController.getMe);

/**
 * @route   PATCH /api/auth/change-password
 * @desc    Change password for the authenticated user
 * @access  Private (all roles)
 */
router.patch(
  '/change-password',
  protect,
  [
    body('oldPassword')
      .notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword')
      .notEmpty().withMessage('Confirm password is required')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) throw new Error('Passwords do not match');
        return true;
      }),
    validate,
  ],
  AuthController.changePassword
);

const rateLimiter = require('../../middlewares/rateLimiter');

// ─── Separate OTP Rate Limiters ────────────────────────────

// Send OTP → strict
const otpSendRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: 'Too many OTP requests. Wait 1 minute.',
});

// Verify OTP → more relaxed
const otpVerifyRateLimit = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: 'Too many verification attempts. Please wait a few minutes.',
});
// ─── OTP / Phone Login ─────────────────────────────────────

/** POST /api/auth/otp/send */
router.post('/otp/send', otpSendRateLimit, [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  validate,
], AuthController.sendOtp);

/** POST /api/auth/otp/verify */
router.post('/otp/verify', otpVerifyRateLimit, [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('otp').trim().notEmpty().withMessage('OTP is required').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  validate,
], AuthController.verifyOtp);

/** POST /api/auth/refresh — get new access token from refresh token */
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validate,
], AuthController.refreshToken);

/** POST /api/auth/logout — optional auth, clears refresh token */
router.post('/logout', protect, AuthController.logout);

module.exports = router;
