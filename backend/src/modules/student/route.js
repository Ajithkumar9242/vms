const router = require('express').Router();
const StudentController = require('./controller');
const { protect } = require('../../middlewares/auth');
const { validate, query, mongoIdParam, paginationQuery } = require('../../utils/validators');

// ─── All student routes require authentication ──────────────
router.use(protect);

/**
 * @route   GET /api/students
 * @desc    Get all students (filter by ?classId=xxx&sectionId=xxx&search=xxx)
 * @access  Private
 */
router.get(
  '/',
  [
    ...paginationQuery,
    query('classId')
      .optional({ values: 'falsy' })
      .isMongoId()
      .withMessage('Invalid classId format'),
    query('sectionId')
      .optional({ values: 'falsy' })
      .isMongoId()
      .withMessage('Invalid sectionId format'),
  ],
  validate,
  StudentController.getAll
);

/**
 * @route   GET /api/students/:id
 * @desc    Get single student by ID
 * @access  Private
 */
router.get('/:id', mongoIdParam('id'), validate, StudentController.getById);

module.exports = router;

