const router = require('express').Router();
const ParentController = require('./controller');
const { protect, authorize } = require('../../middlewares/auth');
const { validate, body, mongoIdParam } = require('../../utils/validators');

router.use(protect);

router.post(
  '/',
  authorize('admin', 'super_admin', 'principal'),
  [
    body('name').trim().notEmpty().withMessage('Parent name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('email').optional().isEmail().withMessage('Valid email required'),
  ],
  validate,
  ParentController.create
);

router.get('/', ParentController.getAll);
router.get('/:id', mongoIdParam('id'), validate, ParentController.getById);

router.patch(
  '/:id/link',
  authorize('admin', 'super_admin', 'principal'),
  [
    mongoIdParam('id'),
    body('studentId').isMongoId().withMessage('Valid student ID is required'),
  ],
  validate,
  ParentController.linkStudent
);

module.exports = router;
