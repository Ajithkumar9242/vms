const Student = require('../../models/Student');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');

/**
 * Student Service — business logic for student management.
 * Handles student listing and retrieval.
 */
class StudentService {
  /**
   * Get all students with filters and pagination.
   * @param {Object} query - { classId, sectionId, isActive, search, page, limit }
   * @returns {{ students: Array, total: number, page: number, limit: number }}
   */
  static async getStudents(query = {}) {
    const filter = {};

    // Only apply ObjectId filters when the value is a valid Mongo ID
    if (query.classId && mongoose.isValidObjectId(query.classId)) {
      filter.classId = query.classId;
    }
    if (query.sectionId && mongoose.isValidObjectId(query.sectionId)) {
      filter.sectionId = query.sectionId;
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }
    // Search by name or rollNo
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { rollNo: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('classId', 'name code')
        .populate('sectionId', 'name')
        .populate('admissionId', 'applicationNo status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(filter),
    ]);

    return { students, total, page, limit };
  }

  /**
   * Get a single student by ID with full details.
   * @param {string} studentId
   * @returns {Object} student document
   */
  static async getStudentById(studentId) {
    const student = await Student.findById(studentId)
      .populate('classId', 'name code')
      .populate('sectionId', 'name capacity')
      .populate('admissionId', 'applicationNo status approvedAt');

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    return student;
  }
}

module.exports = StudentService;
