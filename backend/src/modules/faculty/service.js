const Faculty = require('../../models/Faculty');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');
const AuthService = require('../auth/service');

/**
 * Faculty Service — full CRUD for faculty management.
 */
class FacultyService {
  static async create(data) {
    // Auto-generate employeeId if not provided
    if (!data.employeeId) {
      const count = await Faculty.countDocuments();
      data.employeeId = `FAC-${String(count + 1).padStart(4, '0')}`;
    }

    const faculty = await Faculty.create(data);

    // Auto-create User account for faculty (if email provided)
    if (faculty.email) {
      AuthService.createFacultyUser(faculty).catch((e) =>
        console.error('Faculty user creation failed:', e.message)
      );
    }

    return Faculty.findById(faculty._id)
      .populate('subjects', 'name code')
      .populate('assignedClasses', 'name code');
  }

  static async getAll({ page = 1, limit = 20, search, isActive } = {}) {
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [faculty, total] = await Promise.all([
      Faculty.find(filter)
        .populate('subjects', 'name code')
        .populate('assignedClasses', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Faculty.countDocuments(filter),
    ]);

    return { faculty, total, page, limit };
  }

  static async getById(facultyId) {
    if (!mongoose.isValidObjectId(facultyId)) {
      throw new AppError('Invalid faculty ID format', 400);
    }

    const faculty = await Faculty.findById(facultyId)
      .populate('subjects', 'name code')
      .populate('assignedClasses', 'name code');

    if (!faculty) throw new AppError('Faculty not found', 404);
    return faculty;
  }

  static async assignClasses(facultyId, classIds) {
    if (!mongoose.isValidObjectId(facultyId)) {
      throw new AppError('Invalid faculty ID format', 400);
    }

    // Validate all classIds
    for (const id of classIds) {
      if (!mongoose.isValidObjectId(id)) {
        throw new AppError(`Invalid class ID: ${id}`, 400);
      }
    }

    const faculty = await Faculty.findByIdAndUpdate(
      facultyId,
      { assignedClasses: classIds },
      { new: true }
    )
      .populate('subjects', 'name code')
      .populate('assignedClasses', 'name code');

    if (!faculty) throw new AppError('Faculty not found', 404);
    return faculty;
  }

  static async assignSubjects(facultyId, subjectIds) {
    if (!mongoose.isValidObjectId(facultyId)) {
      throw new AppError('Invalid faculty ID format', 400);
    }

    const faculty = await Faculty.findByIdAndUpdate(
      facultyId,
      { subjects: subjectIds },
      { new: true }
    )
      .populate('subjects', 'name code')
      .populate('assignedClasses', 'name code');

    if (!faculty) throw new AppError('Faculty not found', 404);
    return faculty;
  }
}

module.exports = FacultyService;
