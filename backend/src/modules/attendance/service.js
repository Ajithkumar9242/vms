const Attendance = require('../../models/Attendance');
const Student = require('../../models/Student');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');
const ActivityService = require('../activity/service');

/**
 * Attendance Service — business logic for attendance module.
 * All DB operations and data processing go here.
 */
class AttendanceService {
  /**
   * Get module operational status.
   */
  static async getModuleStatus() {
    return { module: 'attendance', status: 'Attendance module is operational' };
  }

  // ═══════════════════════════════════════════════════════════
  //  MARK ATTENDANCE (bulk)
  // ═══════════════════════════════════════════════════════════

  /**
   * Save attendance records for a list of students on a given date.
   * Uses bulkWrite with upsert so re-submitting for the same date
   * updates instead of throwing a duplicate error.
   *
   * @param {Array} records – [{ studentId, classId, sectionId, date, status }]
   * @param {string} markedBy – userId of the teacher/admin
   * @returns {{ saved: number, updated: number }}
   */
  static async markAttendance(records, markedBy) {
    if (!records || !records.length) {
      throw new AppError('No attendance records provided', 400);
    }

    const ops = records.map((r) => ({
      updateOne: {
        filter: { studentId: r.studentId, date: new Date(r.date) },
        update: {
          $set: {
            studentId: r.studentId,
            classId: r.classId,
            sectionId: r.sectionId || null,
            date: new Date(r.date),
            status: r.status,
            markedBy: markedBy || null,
            remarks: r.remarks || null,
          },
        },
        upsert: true,
      },
    }));

    const result = await Attendance.bulkWrite(ops);

    // Activity log — one entry per batch (non-blocking)
    ActivityService.log({
      action: `Attendance marked for ${records.length} students`,
      module: 'attendance',
      performedBy: markedBy || null,
      metadata: {
        classId: records[0]?.classId,
        date: records[0]?.date,
        count: records.length,
      },
    }).catch((e) => console.error('Activity log failed:', e.message));

    return {
      saved: result.upsertedCount || 0,
      updated: result.modifiedCount || 0,
      total: records.length,
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  GET ATTENDANCE — for a class/date
  // ═══════════════════════════════════════════════════════════

  /**
   * Get attendance records for a specific date + class (+ optional section).
   * Returns populated student data.
   */
  static async getAttendanceByDate({ classId, sectionId, date }) {
    const query = { date: new Date(date) };
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;

    const records = await Attendance.find(query)
      .populate('studentId', 'name rollNo')
      .sort({ 'studentId.rollNo': 1 })
      .lean();

    return records;
  }

  // ═══════════════════════════════════════════════════════════
  //  VIEW ATTENDANCE — aggregated report
  // ═══════════════════════════════════════════════════════════

  /**
   * Get aggregated attendance summary for students.
   * Filters: classId (required), dateFrom, dateTo
   * Returns per-student: totalPresent, totalAbsent, percentage
   */
  static async getAttendanceReport({ classId, dateFrom, dateTo }) {
    if (!classId) {
      throw new AppError('Class filter is required for attendance report', 400);
    }

    if (!mongoose.isValidObjectId(classId)) {
      throw new AppError('Invalid class ID format', 400);
    }

    // Build date filter
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);

    const matchStage = { classId: require('mongoose').Types.ObjectId.createFromHexString(classId) };
    if (Object.keys(dateFilter).length) matchStage.date = dateFilter;

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$studentId',
          totalPresent: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] },
          },
          totalAbsent: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] },
          },
          totalLate: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] },
          },
          totalDays: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: '$student' },
      {
        $project: {
          _id: 1,
          studentName: '$student.name',
          rollNo: '$student.rollNo',
          totalPresent: 1,
          totalAbsent: 1,
          totalLate: 1,
          totalDays: 1,
          percentage: {
            $cond: [
              { $gt: ['$totalDays', 0] },
              {
                $round: [
                  { $multiply: [{ $divide: ['$totalPresent', '$totalDays'] }, 100] },
                  1,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { rollNo: 1 } },
    ];

    const report = await Attendance.aggregate(pipeline);
    return report;
  }
}

module.exports = AttendanceService;
