const router = require('express').Router();
const AttendanceController = require('./controller');
const { protect, authorize } = require('../../middlewares/auth');
const { validate, body, query } = require('../../utils/validators');
const idempotency = require('../../middlewares/idempotency');

// ─── All attendance routes require authentication ───────────
router.use(protect);

/**
 * @route   GET /api/attendance/health
 */
router.get('/health', AttendanceController.health);

/**
 * @route   GET /api/attendance/sessions
 * @desc    Get configured sessions from AttendanceConfig
 * @access  Private
 */
router.get('/sessions', AttendanceController.getSessions);

/**
 * @route   POST /api/attendance
 * @desc    Mark attendance (bulk) for a class on a date+session
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
    body('records.*.session')
      .optional()
      .isString()
      .withMessage('Session must be a string'),
  ],
  validate,
  AttendanceController.markAttendance
);

/**
 * @route   POST /api/attendance/lock
 * @desc    Lock attendance for class + date + session (admin only)
 * @access  Private (admin, super_admin)
 */
router.post(
  '/lock',
  authorize('admin', 'super_admin', 'faculty'),
  [
    body('classId').isMongoId().withMessage('Valid class ID is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('session').optional().isString(),
  ],
  validate,
  AttendanceController.lockAttendance
);

/**
 * @route   GET /api/attendance
 * @desc    Get attendance records (?classId=xxx&date=xxx&sectionId=xxx&session=xxx)
 * @access  Private
 */
router.get(
  '/',
  [
    query('date').optional().isISO8601().withMessage('Valid date is required'),
    query('session').optional().isString(),
  ],
  validate,
  AttendanceController.getAttendance
);

/**
 * @route   GET /api/attendance/report
 * @desc    Aggregated attendance report
 * @access  Private
 */
router.get(
  '/report',
  [
    query('classId').isMongoId().withMessage('Valid class ID is required'),
    query('dateFrom').optional().isISO8601().withMessage('Valid dateFrom required'),
    query('dateTo').optional().isISO8601().withMessage('Valid dateTo required'),
    query('session').optional().isString(),
  ],
  validate,
  AttendanceController.getReport
);

module.exports = router;
