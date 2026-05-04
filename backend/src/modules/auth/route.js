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

module.exports = router;
