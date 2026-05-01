const AdmissionService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Admission Controller — handles HTTP request/response.
 * Delegates all business logic to AdmissionService.
 */
class AdmissionController {
  /**
   * POST /api/admissions
   * Create a new admission application.
   */
  static async create(req, res, next) {
    try {
      const admission = await AdmissionService.createAdmission(req.body);
      return ApiResponse.created(res, { admission }, 'Admission application created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admissions
   * Get all admissions with filters.
   */
  static async getAll(req, res, next) {
    try {
      const result = await AdmissionService.getAdmissions(req.query);
      return ApiResponse.paginated(res, result.admissions, {
        total: result.total,
        page: result.page,
        limit: result.limit,
      }, 'Admissions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admissions/:id
   * Get a single admission by ID.
   */
  static async getById(req, res, next) {
    try {
      const admission = await AdmissionService.getAdmissionById(req.params.id);
      return ApiResponse.success(res, { admission }, 'Admission retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admissions/status/:applicationNo
   * Public — get admission status by application number.
   */
  static async getByApplicationNo(req, res, next) {
    try {
      const admission = await AdmissionService.getAdmissionByApplicationNo(req.params.applicationNo);
      return ApiResponse.success(res, { admission }, 'Application status retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admissions/search?phone=xxx
   * Public — search admissions by phone number.
   */
  static async searchByPhone(req, res, next) {
    try {
      const admissions = await AdmissionService.searchAdmissionsByPhone(req.query.phone);
      return ApiResponse.success(res, { admissions }, 'Search results');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admissions/classes
   * Public — get available classes for admission form.
   */
  static async getPublicClasses(req, res, next) {
    try {
      const Class = require('../../models/Class');
      const classes = await Class.find().select('name code').sort({ name: 1 });
      return ApiResponse.success(res, { classes }, 'Classes retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admissions/:id/approve
   * Approve an admission and create student record.
   */
  static async approve(req, res, next) {
    try {
      const { admission, student } = await AdmissionService.approveAdmission(
        req.params.id,
        req.user._id
      );
      return ApiResponse.success(res, { admission, student }, 'Admission approved and student created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admissions/:id/reject
   * Reject an admission.
   */
  static async reject(req, res, next) {
    try {
      const admission = await AdmissionService.rejectAdmission(
        req.params.id,
        req.user._id,
        req.body.remarks
      );
      return ApiResponse.success(res, { admission }, 'Admission rejected');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdmissionController;
