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

module.exports = router;
