const express = require('express');
const SetupController = require('./controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

// Apply authentication middleware to all setup routes
router.use(protect);

// Setup module is typically admin-only
router.use(authorize('admin', 'super-admin'));

// Academic Year Routes
router.post('/academic-years', SetupController.createAcademicYear);
router.get('/academic-years', SetupController.getAcademicYears);
router.get('/academic-years/active', SetupController.getActiveAcademicYear);
router.put('/academic-years/:id', SetupController.updateAcademicYear);

// Class Config Routes
router.post('/class-configs', SetupController.upsertClassConfig);
router.get('/class-configs/:academicYearId', SetupController.getClassConfigs);

module.exports = router;
