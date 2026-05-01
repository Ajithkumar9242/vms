const AcademicYear = require('../../models/AcademicYear');
const ClassConfig = require('../../models/ClassConfig');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');

class SetupService {
  /**
   * Create a new Academic Year. If set to active, deactivate all others.
   */
  static async createAcademicYear(data) {
    if (data.isActive) {
      await AcademicYear.updateMany({}, { isActive: false });
    }
    const year = await AcademicYear.create(data);
    return year;
  }

  /**
   * Update an Academic Year.
   */
  static async updateAcademicYear(id, data) {
    if (data.isActive) {
      await AcademicYear.updateMany({ _id: { $ne: id } }, { isActive: false });
    }
    const year = await AcademicYear.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!year) {
      throw new AppError('Academic Year not found', 404);
    }
    return year;
  }

  /**
   * Get all Academic Years
   */
  static async getAcademicYears() {
    return AcademicYear.find().sort({ startDate: -1 });
  }

  /**
   * Get the current active Academic Year
   */
  static async getActiveAcademicYear() {
    const year = await AcademicYear.findOne({ isActive: true });
    if (!year) {
      throw new AppError('No active academic year found. Please create one in Setup.', 404);
    }
    return year;
  }

  /**
   * Resolve academicYearId — returns provided ID or falls back to active year.
   * Safe fallback: returns null if no active year exists (won't crash).
   * @param {string|null} academicYearId - optional explicit ID
   * @returns {string|null} resolved ObjectId string or null
   */
  static async resolveAcademicYearId(academicYearId) {
    // If explicitly provided and valid, use it
    if (academicYearId && mongoose.isValidObjectId(academicYearId)) {
      return academicYearId;
    }

    // Auto-fallback to active academic year
    const active = await AcademicYear.findOne({ isActive: true }).select('_id');
    return active ? active._id : null;
  }

  /**
   * Create or update a Class Config for an Academic Year
   */
  static async upsertClassConfig(data) {
    const { academicYearId, classId, sections, subjects, feeStructureId } = data;

    if (!academicYearId || !classId) {
      throw new AppError('Academic Year and Class are required for Class Config', 400);
    }

    let config = await ClassConfig.findOne({ academicYearId, classId });
    if (config) {
      config.sections = sections || config.sections;
      config.subjects = subjects || config.subjects;
      config.feeStructureId = feeStructureId || config.feeStructureId;
      await config.save();
    } else {
      config = await ClassConfig.create(data);
    }
    
    return ClassConfig.findById(config._id)
      .populate('classId')
      .populate('sections')
      .populate('subjects')
      .populate('feeStructureId');
  }

  /**
   * Get all Class Configs for an Academic Year
   */
  static async getClassConfigs(academicYearId) {
    return ClassConfig.find({ academicYearId })
      .populate('classId')
      .populate('sections')
      .populate('subjects')
      .populate('feeStructureId');
  }

  /**
   * Validate that a class exists in ClassConfig for a given academic year.
   * Returns the config if found, null if no configs exist yet (graceful).
   * @param {string} classId
   * @param {string} academicYearId
   * @returns {Object|null}
   */
  static async validateClassForYear(classId, academicYearId) {
    if (!academicYearId) return null; // No year = no config to validate against

    // Check if ANY ClassConfigs exist for this year (if none, skip validation — system not configured yet)
    const configCount = await ClassConfig.countDocuments({ academicYearId });
    if (configCount === 0) return null; // Graceful: configs not set up yet

    const config = await ClassConfig.findOne({ academicYearId, classId });
    if (!config) {
      throw new AppError('This class is not configured for the selected academic year', 400);
    }
    return config;
  }

  /**
   * Validate that subjects belong to a class in ClassConfig.
   * Returns true if valid, throws if not.
   * @param {string[]} subjectIds - subject IDs to validate
   * @param {string} classId
   * @param {string} academicYearId
   */
  static async validateSubjectsForClass(subjectIds, classId, academicYearId) {
    if (!academicYearId || !subjectIds || subjectIds.length === 0) return;

    const config = await ClassConfig.findOne({ academicYearId, classId });
    if (!config || !config.subjects || config.subjects.length === 0) return; // Not configured yet, skip

    const allowedSubjects = config.subjects.map((s) => s.toString());
    const invalid = subjectIds.filter((id) => !allowedSubjects.includes(id.toString()));

    if (invalid.length > 0) {
      throw new AppError(
        `Subjects [${invalid.join(', ')}] are not assigned to this class for this academic year`,
        400
      );
    }
  }
}

module.exports = SetupService;
