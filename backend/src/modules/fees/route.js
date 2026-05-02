const router = require('express').Router();
const FeesController = require('./controller');
const { protect, authorize } = require('../../middlewares/auth');
const { validate, body, mongoIdParam } = require('../../utils/validators');
const idempotency = require('../../middlewares/idempotency');

router.use(protect);

router.get('/health', FeesController.health);

// ─── FEE STRUCTURE ───────────────────────────────────────────
router.post(
  '/structure',
  idempotency(),
  [
    body('classId').isMongoId().withMessage('Valid class ID is required'),
    body('academicYear').optional().trim(),
    body('academicYearId').optional().isMongoId(),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a non-negative number'),
    body('installments').optional().isArray().withMessage('Installments must be an array'),
    body('installments.*.name').optional().notEmpty(),
    body('installments.*.amount').optional().isFloat({ min: 0 }),
    body('installments.*.dueDate').optional().isISO8601(),
  ],
  validate,
  FeesController.createStructure
);

router.get('/structure', FeesController.getStructures);

// ─── INVOICE ─────────────────────────────────────────────────
router.post(
  '/invoice/generate',
  authorize('admin', 'super_admin'),
  [body('studentId').isMongoId().withMessage('Valid student ID is required')],
  validate,
  FeesController.generateInvoice
);

router.get(
  '/invoice/:studentId',
  mongoIdParam('studentId'),
  validate,
  FeesController.getInvoice
);

// ─── DUE LIST ────────────────────────────────────────────────
router.get('/due', FeesController.getDueList);

// ─── PAYMENTS ────────────────────────────────────────────────
router.post(
  '/pay',
  idempotency(),
  [
    body('studentId').isMongoId().withMessage('Valid student ID is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Payment amount must be at least 1'),
    body('paymentMode')
      .isIn(['cash', 'upi', 'online', 'razorpay'])
      .withMessage('Payment mode must be cash, upi, online, or razorpay'),
    body('transactionId').optional({ nullable: true }).isString(),
    body('invoiceId').optional({ nullable: true }).isMongoId(),
  ],
  validate,
  FeesController.recordPayment
);

router.get('/student/:studentId', mongoIdParam('studentId'), validate, FeesController.getStudentFees);

// ─── APPLY STRUCTURE (bulk) ──────────────────────────────────
router.post(
  '/apply-structure',
  authorize('admin', 'super_admin'),
  [body('classId').isMongoId().withMessage('Valid class ID is required')],
  validate,
  FeesController.applyStructure
);

// ─── MANUAL PAYMENT FLOW ─────────────────────────────────────
router.post(
  '/manual-payment',
  [
    body('studentId').isMongoId().withMessage('Valid student ID is required'),
    body('amount').isFloat({ min: 1 }),
    body('transactionId').optional().isString(),
    body('proofUrl').optional().isURL().withMessage('proofUrl must be a valid URL'),
    body('invoiceId').optional({ nullable: true }).isMongoId(),
  ],
  validate,
  FeesController.manualPayment
);

router.get('/payments/pending', authorize('admin', 'super_admin'), FeesController.getPendingPayments);

router.put(
  '/payment/:id/approve',
  authorize('admin', 'super_admin'),
  mongoIdParam('id'), validate,
  FeesController.approvePayment
);

router.put(
  '/payment/:id/reject',
  authorize('admin', 'super_admin'),
  mongoIdParam('id'), validate,
  FeesController.rejectPayment
);

// ─── OVERVIEW ────────────────────────────────────────────────
router.get('/overview', FeesController.getOverview);

// ─── RECEIPT (PDF) ───────────────────────────────────────────
router.get('/:id/receipt', mongoIdParam('id'), validate, FeesController.generateReceipt);

module.exports = router;
