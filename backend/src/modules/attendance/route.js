const router = require('express').Router();
const AttendanceController = require('./controller');
const { protect } = require('../../middlewares/auth');
const { validate, body, query } = require('../../utils/validators');
const idempotency = require('../../middlewares/idempotency');

// ─── All attendance routes require authentication ───────────
router.use(protect);

/**
 * @route   GET /api/attendance/health
 * @desc    Module health check
 * @access  Private
 */
router.get('/health', AttendanceController.health);

/**
 * @route   POST /api/attendance
 * @desc    Mark attendance (bulk) for a class on a date
 * @access  Private
 */
router.post(
  '/',
  idempotency(),
  [
    body('records')
      .isArray({ min: 1 })
      .withMessage('Records must be a non-empty array'),
    body('records.*.studentId')
      .isMongoId()
      .withMessage('Valid student ID is required'),
    body('records.*.classId')
      .isMongoId()
      .withMessage('Valid class ID is required'),
    body('records.*.date')
      .isISO8601()
      .withMessage('Valid date is required'),
    body('records.*.status')
      .isIn(['present', 'absent', 'late', 'excused'])
      .withMessage('Status must be present, absent, late, or excused'),
  ],
  validate,
  AttendanceController.markAttendance
);

/**
 * @route   GET /api/attendance
 * @desc    Get attendance records (?classId=xxx&date=xxx&sectionId=xxx)
 * @access  Private
 */
router.get(
  '/',
  [
    query('date').optional().isISO8601().withMessage('Valid date is required'),
  ],
  validate,
  AttendanceController.getAttendance
);

/**
 * @route   GET /api/attendance/report
 * @desc    Aggregated attendance report (?classId=xxx&dateFrom=xxx&dateTo=xxx)
 * @access  Private
 */
router.get(
  '/report',
  [
    query('classId').isMongoId().withMessage('Valid class ID is required'),
    query('dateFrom').optional().isISO8601().withMessage('Valid dateFrom required'),
    query('dateTo').optional().isISO8601().withMessage('Valid dateTo required'),
  ],
  validate,
  AttendanceController.getReport
);

module.exports = router;
