const AttendanceService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Attendance Controller — handles HTTP request/response.
 * Delegates all business logic to AttendanceService.
 */
class AttendanceController {
  /**
   * GET /api/attendance/health
   * Module health check.
   */
  static async health(req, res, next) {
    try {
      const data = await AttendanceService.getModuleStatus();
      return ApiResponse.success(res, data, 'Attendance module operational');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/attendance
   * Mark attendance in bulk for a class on a given date.
   * Body: { records: [{ studentId, classId, sectionId?, date, status }] }
   */
  static async markAttendance(req, res, next) {
    try {
      const { records } = req.body;
      const markedBy = req.user?._id || null;
      const result = await AttendanceService.markAttendance(records, markedBy);
      return ApiResponse.created(res, result, 'Attendance saved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/attendance
   * Get attendance records.
   * Query: ?classId=xxx&sectionId=xxx&date=2026-04-30
   */
  static async getAttendance(req, res, next) {
    try {
      const { classId, sectionId, date } = req.query;
      const records = await AttendanceService.getAttendanceByDate({
        classId,
        sectionId,
        date,
      });
      return ApiResponse.success(res, records, 'Attendance records fetched');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/attendance/report
   * Get aggregated attendance report for a class.
   * Query: ?classId=xxx&dateFrom=xxx&dateTo=xxx
   */
  static async getReport(req, res, next) {
    try {
      const { classId, dateFrom, dateTo } = req.query;
      const report = await AttendanceService.getAttendanceReport({
        classId,
        dateFrom,
        dateTo,
      });
      return ApiResponse.success(res, report, 'Attendance report generated');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AttendanceController;
