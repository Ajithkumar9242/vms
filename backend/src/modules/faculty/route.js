const router = require('express').Router();
const FacultyController = require('./controller');
const { protect, authorize } = require('../../middlewares/auth');
const { validate, body, mongoIdParam } = require('../../utils/validators');

router.use(protect);

router.post(
  '/',
  authorize('admin', 'super_admin'),
  [
    body('name').trim().notEmpty().withMessage('Faculty name is required'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('phone').optional().trim(),
    body('designation').optional().trim(),
    body('department').optional().trim(),
    body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  ],
  validate,
  FacultyController.create
);

router.get('/', FacultyController.getAll);
router.get('/:id', mongoIdParam('id'), validate, FacultyController.getById);

router.patch(
  '/:id/assign-classes',
  authorize('admin', 'super_admin'),
  [
    mongoIdParam('id'),
    body('classIds').isArray({ min: 0 }).withMessage('classIds must be an array'),
  ],
  validate,
  FacultyController.assignClasses
);

router.patch(
  '/:id/assign-subjects',
  authorize('admin', 'super_admin'),
  [
    mongoIdParam('id'),
    body('subjectIds').isArray({ min: 0 }).withMessage('subjectIds must be an array'),
  ],
  validate,
  FacultyController.assignSubjects
);

module.exports = router;
