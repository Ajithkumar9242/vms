const StudentService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Student Controller — handles HTTP request/response.
 * Delegates all business logic to StudentService.
 */
class StudentController {
  /**
   * GET /api/students
   * Get all students with filters.
   */
  static async getAll(req, res, next) {
    try {
      const result = await StudentService.getStudents(req.query);
      return ApiResponse.paginated(res, result.students, {
        total: result.total,
        page: result.page,
        limit: result.limit,
      }, 'Students retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/students/:id
   * Get a single student by ID.
   */
  static async getById(req, res, next) {
    try {
      const student = await StudentService.getStudentById(req.params.id);
      return ApiResponse.success(res, { student }, 'Student retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = StudentController;
