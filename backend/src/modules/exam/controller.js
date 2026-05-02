const ExamService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Exam Controller — handles HTTP request/response.
 * Delegates all business logic to ExamService.
 */
class ExamController {
  /**
   * GET /api/exams/health
   * Module health check.
   */
  static async health(req, res, next) {
    try {
      const data = await ExamService.getModuleStatus();
      return ApiResponse.success(res, data, 'Exam module operational');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exams/subjects-for-class?classId=xxx
   * Get subjects for a class (from ClassConfig or all subjects).
   */
  static async getSubjectsForClass(req, res, next) {
    try {
      const subjects = await ExamService.getSubjectsForClass(req.query.classId);
      return ApiResponse.success(res, subjects, 'Subjects fetched');
    } catch (error) {
      next(error);
    }
  }


  //  EXAMS
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/exams
   * Create a new exam.
   */
  static async createExam(req, res, next) {
    try {
      const exam = await ExamService.createExam(req.body);
      return ApiResponse.created(res, exam, 'Exam created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exams
   * List all exams (optional ?classId=xxx&academicYear=xxx).
   */
  static async getExams(req, res, next) {
    try {
      const { classId, academicYear, academicYearId } = req.query;
      const exams = await ExamService.getExams({ classId, academicYearId: academicYearId || academicYear });
      return ApiResponse.success(res, exams, 'Exams fetched');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exams/:id
   * Get a single exam by ID.
   */
  static async getExamById(req, res, next) {
    try {
      const exam = await ExamService.getExamById(req.params.id);
      return ApiResponse.success(res, exam, 'Exam details fetched');
    } catch (error) {
      next(error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  MARKS
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/exams/:examId/marks
   * Bulk save marks for an exam.
   */
  static async saveMarks(req, res, next) {
    try {
      const { examId } = req.params;
      const { marks } = req.body;
      const result = await ExamService.saveMarks(examId, marks);
      return ApiResponse.created(res, result, 'Marks saved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exams/:examId/marks
   * Get all marks for an exam.
   */
  static async getExamMarks(req, res, next) {
    try {
      const { examId } = req.params;
      const data = await ExamService.getExamMarks(examId);
      return ApiResponse.success(res, data, 'Exam marks fetched');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/exams/results/:studentId
   * Get all results for a student.
   */
  static async getStudentResults(req, res, next) {
    try {
      const { studentId } = req.params;
      const data = await ExamService.getStudentResults(studentId);
      return ApiResponse.success(res, data, 'Student results fetched');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExamController;
