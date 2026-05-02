const mongoose = require('mongoose');
const AcademicYear = require('../../models/AcademicYear');
const AcademicTerm = require('../../models/AcademicTerm');
const ClassConfig = require('../../models/ClassConfig');
const ClassGroup = require('../../models/ClassGroup');
const SchoolSetting = require('../../models/SchoolSetting');
const FeeGroup = require('../../models/FeeGroup');
const FeeStructure = require('../../models/FeeStructure');
const GradeConfig = require('../../models/GradeConfig');
const AttendanceConfig = require('../../models/AttendanceConfig');
const PaymentSetting = require('../../models/PaymentSetting');
const AppError = require('../../utils/AppError');

class SetupService {
  // ═══════════════════════════════════════════════════════════
  //  SCHOOL SETTING (singleton)
  // ═══════════════════════════════════════════════════════════

  static async getSchoolSetting() {
    return SchoolSetting.findOne();
  }

  static async upsertSchoolSetting(data) {
    const existing = await SchoolSetting.findOne();
    if (existing) {
      Object.assign(existing, data);
      return existing.save();
    }
    return SchoolSetting.create(data);
  }

  // ═══════════════════════════════════════════════════════════
  //  ACADEMIC YEAR
  // ═══════════════════════════════════════════════════════════

  static async createAcademicYear(data) {
    if (data.isActive) {
      await AcademicYear.updateMany({}, { isActive: false });
    }
    return AcademicYear.create(data);
  }

  static async updateAcademicYear(id, data) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid ID', 400);
    if (data.isActive) {
      await AcademicYear.updateMany({ _id: { $ne: id } }, { isActive: false });
    }
    const year = await AcademicYear.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!year) throw new AppError('Academic Year not found', 404);
    return year;
  }

  static async getAcademicYears() {
    return AcademicYear.find().sort({ startDate: -1 });
  }

  static async getActiveAcademicYear() {
    // First try isActive flag, then fall back to current date range
    let year = await AcademicYear.findOne({ isActive: true });
    if (!year) {
      const now = new Date();
      year = await AcademicYear.findOne({ startDate: { $lte: now }, endDate: { $gte: now } });
    }
    if (!year) throw new AppError('No active academic year found. Please create one in Setup.', 404);
    return year;
  }

  // Shared helper used by other services
  static async resolveAcademicYearId(academicYearId) {
    if (academicYearId && mongoose.isValidObjectId(academicYearId)) return academicYearId;
    const active = await AcademicYear.findOne({ isActive: true }).select('_id');
    return active ? active._id : null;
  }

  // ═══════════════════════════════════════════════════════════
  //  ACADEMIC TERMS
  // ═══════════════════════════════════════════════════════════

  static async createTerm(data) {
    if (!data.academicYearId) {
      data.academicYearId = await SetupService.resolveAcademicYearId(null);
    }
    return AcademicTerm.create(data);
  }

  static async getTerms(academicYearId) {
    const yearId = await SetupService.resolveAcademicYearId(academicYearId);
    return AcademicTerm.find({ academicYearId: yearId }).sort({ startDate: 1 });
  }

  static async updateTerm(id, data) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid ID', 400);
    const term = await AcademicTerm.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!term) throw new AppError('Term not found', 404);
    return term;
  }

  static async deleteTerm(id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid ID', 400);
    const term = await AcademicTerm.findByIdAndDelete(id);
    if (!term) throw new AppError('Term not found', 404);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  CLASS CONFIG
  // ═══════════════════════════════════════════════════════════

  static async upsertClassConfig(data) {
    const { academicYearId, classId, sections, subjects, feeStructureId } = data;
    if (!academicYearId || !classId) throw new AppError('academicYearId and classId are required', 400);

    let config = await ClassConfig.findOne({ academicYearId, classId });
    if (config) {
      if (sections !== undefined) config.sections = sections;
      if (subjects !== undefined) config.subjects = subjects;
      if (feeStructureId !== undefined) config.feeStructureId = feeStructureId;
      await config.save();
    } else {
      config = await ClassConfig.create(data);
    }
    return ClassConfig.findById(config._id)
      .populate('classId', 'name code')
      .populate('sections', 'name')
      .populate('subjects', 'name code');
  }

  static async getClassConfigs(academicYearId) {
    const yearId = await SetupService.resolveAcademicYearId(academicYearId);
    return ClassConfig.find({ academicYearId: yearId })
      .populate('classId', 'name code order')
      .populate('sections', 'name')
      .populate('subjects', 'name code isOptional');
  }

  // Validation helpers used by other services
  static async validateClassForYear(classId, academicYearId) {
    if (!academicYearId) return null;
    const configCount = await ClassConfig.countDocuments({ academicYearId });
    if (configCount === 0) return null;
    const config = await ClassConfig.findOne({ academicYearId, classId });
    if (!config) throw new AppError('This class is not configured for the selected academic year', 400);
    return config;
  }

  static async validateSubjectsForClass(subjectIds, classId, academicYearId) {
    if (!academicYearId || !subjectIds?.length) return;
    const config = await ClassConfig.findOne({ academicYearId, classId });
    if (!config || !config.subjects?.length) return;
    const allowed = config.subjects.map((s) => s.toString());
    const invalid = subjectIds.filter((id) => !allowed.includes(id.toString()));
    if (invalid.length) throw new AppError(`Subjects not assigned to this class: ${invalid.join(', ')}`, 400);
  }

  // ═══════════════════════════════════════════════════════════
  //  CLASS GROUPS
  // ═══════════════════════════════════════════════════════════

  static async createClassGroup(data) {
    return ClassGroup.create(data);
  }

  static async getClassGroups(filters = {}) {
    const query = {};
    if (filters.classId && mongoose.isValidObjectId(filters.classId)) query.classId = filters.classId;
    return ClassGroup.find(query)
      .populate('classId', 'name code')
      .populate('sectionId', 'name')
      .populate('classTeacherId', 'name email');
  }

  static async updateClassGroup(id, data) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid ID', 400);
    const group = await ClassGroup.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!group) throw new AppError('Class Group not found', 404);
    return group;
  }

  static async deleteClassGroup(id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid ID', 400);
    const group = await ClassGroup.findByIdAndDelete(id);
    if (!group) throw new AppError('Class Group not found', 404);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE GROUPS
  // ═══════════════════════════════════════════════════════════

  static async createFeeGroup(data) {
    return FeeGroup.create(data);
  }

  static async getFeeGroups() {
    return FeeGroup.find({ isActive: true }).sort({ name: 1 });
  }

  static async updateFeeGroup(id, data) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid ID', 400);
    const group = await FeeGroup.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!group) throw new AppError('Fee Group not found', 404);
    return group;
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE STRUCTURE (admin side — by group)
  // ═══════════════════════════════════════════════════════════

  static async upsertFeeStructure(data) {
    const { academicYearId: rawYearId, classId, feeGroupId, totalAmount, installments } = data;
    const academicYearId = await SetupService.resolveAcademicYearId(rawYearId);
    if (!classId) throw new AppError('classId is required', 400);

    const filter = { classId, academicYearId };
    if (feeGroupId) filter.feeGroupId = feeGroupId;

    const update = { classId, academicYearId, feeGroupId: feeGroupId || null, totalAmount, installments };
    const structure = await FeeStructure.findOneAndUpdate(filter, update, {
      new: true, upsert: true, runValidators: true,
    }).populate('classId', 'name code');
    return structure;
  }

  static async getFeeStructures(filters = {}) {
    const query = {};
    if (filters.classId) query.classId = filters.classId;
    if (filters.academicYearId) query.academicYearId = filters.academicYearId;
    else if (filters.academicYear) query.academicYearId = filters.academicYear;
    return FeeStructure.find(query).populate('classId', 'name code').sort({ createdAt: -1 });
  }

  // ═══════════════════════════════════════════════════════════
  //  GRADE CONFIG
  // ═══════════════════════════════════════════════════════════

  static async createGradeConfig(data) {
    return GradeConfig.create(data);
  }

  static async getGradeConfigs() {
    return GradeConfig.find().sort({ minMarks: 1 });
  }

  static async updateGradeConfig(id, data) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid ID', 400);
    const grade = await GradeConfig.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!grade) throw new AppError('Grade Config not found', 404);
    return grade;
  }

  static async deleteGradeConfig(id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid ID', 400);
    const grade = await GradeConfig.findByIdAndDelete(id);
    if (!grade) throw new AppError('Grade Config not found', 404);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  ATTENDANCE CONFIG
  // ═══════════════════════════════════════════════════════════

  static async upsertAttendanceConfig(data) {
    const academicYearId = await SetupService.resolveAcademicYearId(data.academicYearId);
    if (!academicYearId) throw new AppError('No active academic year found', 400);
    return AttendanceConfig.findOneAndUpdate(
      { academicYearId },
      { academicYearId, sessions: data.sessions },
      { new: true, upsert: true, runValidators: true }
    );
  }

  static async getAttendanceConfig(academicYearId) {
    const yearId = await SetupService.resolveAcademicYearId(academicYearId);
    return AttendanceConfig.findOne({ academicYearId: yearId });
  }

  // ═══════════════════════════════════════════════════════════
  //  PAYMENT SETTINGS (singleton)
  // ═══════════════════════════════════════════════════════════

  static async getPaymentSettings() {
    return PaymentSetting.findOne();
  }

  static async upsertPaymentSettings(data) {
    const existing = await PaymentSetting.findOne();
    if (existing) {
      Object.assign(existing, data);
      return existing.save();
    }
    return PaymentSetting.create(data);
  }
}

module.exports = SetupService;
