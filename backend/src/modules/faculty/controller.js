const FacultyService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

class FacultyController {
  static async create(req, res, next) {
    try {
      const faculty = await FacultyService.create(req.body);
      return ApiResponse.created(res, faculty, 'Faculty created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req, res, next) {
    try {
      const { page, limit, search, isActive } = req.query;
      const data = await FacultyService.getAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        search,
        isActive,
      });
      return ApiResponse.success(res, data, 'Faculty list fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const faculty = await FacultyService.getById(req.params.id);
      return ApiResponse.success(res, faculty, 'Faculty details fetched');
    } catch (error) {
      next(error);
    }
  }

  static async assignClasses(req, res, next) {
    try {
      const { classIds } = req.body;
      const faculty = await FacultyService.assignClasses(req.params.id, classIds);
      return ApiResponse.success(res, faculty, 'Classes assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  static async assignSubjects(req, res, next) {
    try {
      const { subjectIds } = req.body;
      const faculty = await FacultyService.assignSubjects(req.params.id, subjectIds);
      return ApiResponse.success(res, faculty, 'Subjects assigned successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = FacultyController;
