const router = require('express').Router();
const AdmissionController = require('./controller');
const { protect, authorize } = require('../../middlewares/auth');
const { body, validate, mongoIdParam, paginationQuery, query } = require('../../utils/validators');
const rateLimiter = require('../../middlewares/rateLimiter');

// ═══════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth required — for parents)
// ═══════════════════════════════════════════════════════════

const publicRateLimit = rateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many requests. Please wait a moment.',
});

/**
 * @route   GET /api/admissions/classes
 * @desc    Get available classes for admission form (public)
 * @access  Public
 */
router.get('/classes', publicRateLimit, AdmissionController.getPublicClasses);

/**
 * @route   GET /api/admissions/status/:applicationNo
 * @desc    Check admission status by application number (public)
 * @access  Public
 */
router.get('/status/:applicationNo', publicRateLimit, AdmissionController.getByApplicationNo);

/**
 * @route   GET /api/admissions/search
 * @desc    Search admissions by phone number (public)
 * @access  Public
 */
router.get('/search', publicRateLimit, [
  query('phone').trim().notEmpty().withMessage('Phone number is required'),
  validate,
], AdmissionController.searchByPhone);

// ═══════════════════════════════════════════════════════════
//  PROTECTED ROUTES (auth required)
// ═══════════════════════════════════════════════════════════
router.use(protect);

// ─── Validation Rules ───────────────────────────────────────
const createAdmissionValidation = [
  body('studentName').trim().notEmpty().withMessage('Student name is required'),
  body('dateOfBirth').notEmpty().withMessage('Date of birth is required').isISO8601().withMessage('Invalid date format'),
  body('gender').notEmpty().withMessage('Gender is required').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('classId').notEmpty().withMessage('Class ID is required').isMongoId().withMessage('Invalid Class ID format'),
  body('sectionId').optional({ values: 'null' }).isMongoId().withMessage('Invalid Section ID format'),
  body('parentName').trim().notEmpty().withMessage('Parent/Guardian name is required'),
  body('parentPhone').trim().notEmpty().withMessage('Parent phone is required'),
  body('parentEmail').optional().isEmail().withMessage('Invalid email format'),
  body('address').optional().trim(),
  body('previousSchool').optional().trim(),
  body('remarks').optional().trim(),
  validate,
];

/**
 * @route   POST /api/admissions
 * @desc    Create a new admission application
 * @access  Private (admin, super_admin)
 */
router.post('/', authorize('admin', 'super_admin'), createAdmissionValidation, AdmissionController.create);

/**
 * @route   GET /api/admissions
 * @desc    Get all admissions (filter by ?status=pending&classId=xxx&mode=online)
 * @access  Private
 */
router.get('/', ...paginationQuery, validate, AdmissionController.getAll);

/**
 * @route   GET /api/admissions/:id
 * @desc    Get single admission by ID
 * @access  Private
 */
router.get('/:id', mongoIdParam('id'), validate, AdmissionController.getById);

/**
 * @route   PATCH /api/admissions/:id/approve
 * @desc    Approve admission and create student record
 * @access  Private (admin, super_admin)
 */
router.patch('/:id/approve', authorize('admin', 'super_admin'), mongoIdParam('id'), validate, AdmissionController.approve);

/**
 * @route   PATCH /api/admissions/:id/reject
 * @desc    Reject an admission
 * @access  Private (admin, super_admin)
 */
router.patch('/:id/reject', authorize('admin', 'super_admin'), mongoIdParam('id'), validate, AdmissionController.reject);

module.exports = router;
