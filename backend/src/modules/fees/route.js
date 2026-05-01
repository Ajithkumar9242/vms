const router = require('express').Router();
const FeesController = require('./controller');
const { protect } = require('../../middlewares/auth');
const { validate, body, mongoIdParam } = require('../../utils/validators');
const idempotency = require('../../middlewares/idempotency');

// ─── All fees routes require authentication ─────────────────
router.use(protect);

/**
 * @route   GET /api/fees/health
 * @desc    Module health check
 * @access  Private
 */
router.get('/health', FeesController.health);

// ═══════════════════════════════════════════════════════════
//  FEE STRUCTURE
// ═══════════════════════════════════════════════════════════

/**
 * @route   POST /api/fees/structure
 * @desc    Create or update fee structure for a class
 * @access  Private
 */
router.post(
  '/structure',
  idempotency(),
  [
    body('classId').isMongoId().withMessage('Valid class ID is required'),
    body('academicYear')
      .notEmpty()
      .withMessage('Academic year is required')
      .trim(),
    body('totalAmount')
      .isFloat({ min: 0 })
      .withMessage('Total amount must be a non-negative number'),
    body('installments')
      .optional()
      .isArray()
      .withMessage('Installments must be an array'),
    body('installments.*.name')
      .notEmpty()
      .withMessage('Installment name is required'),
    body('installments.*.amount')
      .isFloat({ min: 0 })
      .withMessage('Installment amount must be non-negative'),
    body('installments.*.dueDate')
      .isISO8601()
      .withMessage('Valid due date is required'),
  ],
  validate,
  FeesController.createStructure
);

/**
 * @route   GET /api/fees/structure
 * @desc    Get all fee structures (?classId=xxx&academicYear=xxx)
 * @access  Private
 */
router.get('/structure', FeesController.getStructures);

// ═══════════════════════════════════════════════════════════
//  FEE PAYMENTS
// ═══════════════════════════════════════════════════════════

/**
 * @route   POST /api/fees/pay
 * @desc    Record a fee payment
 * @access  Private
 */
router.post(
  '/pay',
  idempotency(),
  [
    body('studentId').isMongoId().withMessage('Valid student ID is required'),
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('Payment amount must be at least 1'),
    body('paymentMode')
      .isIn(['cash', 'upi', 'online', 'razorpay'])
      .withMessage('Payment mode must be cash, upi, online, or razorpay'),
    body('transactionId')
      .optional({ nullable: true })
      .isString()
      .withMessage('Transaction ID must be a string'),
  ],
  validate,
  FeesController.recordPayment
);

/**
 * @route   GET /api/fees/student/:studentId
 * @desc    Get fee details + payment history for a student
 * @access  Private
 */
router.get(
  '/student/:studentId',
  mongoIdParam('studentId'),
  validate,
  FeesController.getStudentFees
);

// ═══════════════════════════════════════════════════════════
//  FEE OVERVIEW
// ═══════════════════════════════════════════════════════════

/**
 * @route   GET /api/fees/overview
 * @desc    Fee overview for all students (?classId=xxx)
 * @access  Private
 */
router.get('/overview', FeesController.getOverview);

/**
 * @route   GET /api/fees/:id/receipt
 * @desc    Generate PDF receipt for a fee payment
 * @access  Private
 */
router.get(
  '/:id/receipt',
  mongoIdParam('id'),
  validate,
  FeesController.generateReceipt
);

module.exports = router;
