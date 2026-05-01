const router = require('express').Router();
const ExamController = require('./controller');
const { protect, authorize } = require('../../middlewares/auth');
const { validate, body, query, mongoIdParam } = require('../../utils/validators');
const idempotency = require('../../middlewares/idempotency');

// ─── All exam routes require authentication ─────────────────
router.use(protect);

/**
 * @route   GET /api/exams/health
 * @desc    Module health check
 * @access  Private
 */
router.get('/health', ExamController.health);

/**
 * @route   GET /api/exams/results/:studentId
 * @desc    Get all results for a student
 * @access  Private
 * NOTE: Must be defined BEFORE /:id to avoid route collision
 */
router.get(
  '/results/:studentId',
  mongoIdParam('studentId'),
  validate,
  ExamController.getStudentResults
);

// ═══════════════════════════════════════════════════════════
//  EXAM CRUD
// ═══════════════════════════════════════════════════════════

/**
 * @route   POST /api/exams
 * @desc    Create a new exam
 * @access  Private (admin, super_admin)
 */
router.post(
  '/',
  authorize('admin', 'super_admin'),
  idempotency(),
  [
    body('name').notEmpty().withMessage('Exam name is required').trim(),
    body('classId').isMongoId().withMessage('Valid class ID is required'),
    body('academicYear').notEmpty().withMessage('Academic year is required').trim(),
    body('subjects')
      .isArray({ min: 1 })
      .withMessage('At least one subject is required'),
    body('subjects.*').isMongoId().withMessage('Valid subject ID is required'),
    body('maxMarks')
      .isFloat({ min: 1 })
      .withMessage('Max marks must be at least 1'),
    body('passingMarks')
      .isFloat({ min: 0 })
      .withMessage('Passing marks cannot be negative'),
    body('examDate')
      .optional({ nullable: true })
      .isISO8601()
      .withMessage('Valid exam date required'),
  ],
  validate,
  ExamController.createExam
);

/**
 * @route   GET /api/exams
 * @desc    List all exams (?classId=xxx&academicYear=xxx)
 * @access  Private
 */
router.get(
  '/',
  [
    query('classId')
      .optional({ values: 'falsy' })
      .isMongoId()
      .withMessage('Invalid classId'),
    query('academicYear').optional().trim(),
  ],
  validate,
  ExamController.getExams
);

/**
 * @route   GET /api/exams/:id
 * @desc    Get exam details
 * @access  Private
 */
router.get('/:id', mongoIdParam('id'), validate, ExamController.getExamById);

// ═══════════════════════════════════════════════════════════
//  MARKS
// ═══════════════════════════════════════════════════════════

/**
 * @route   POST /api/exams/:examId/marks
 * @desc    Bulk save marks for an exam
 * @access  Private (admin, super_admin)
 */
router.post(
  '/:examId/marks',
  authorize('admin', 'super_admin'),
  idempotency({ windowMs: 3000 }),
  [
    mongoIdParam('examId'),
    body('marks')
      .isArray({ min: 1 })
      .withMessage('Marks array is required'),
    body('marks.*.studentId')
      .isMongoId()
      .withMessage('Valid student ID is required'),
    body('marks.*.subjectId')
      .isMongoId()
      .withMessage('Valid subject ID is required'),
    body('marks.*.marksObtained')
      .isFloat({ min: 0 })
      .withMessage('Marks obtained must be non-negative'),
  ],
  validate,
  ExamController.saveMarks
);

/**
 * @route   GET /api/exams/:examId/marks
 * @desc    Get all marks for an exam
 * @access  Private
 */
router.get(
  '/:examId/marks',
  mongoIdParam('examId'),
  validate,
  ExamController.getExamMarks
);

module.exports = router;
