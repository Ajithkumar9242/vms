const Class = require('../../models/Class');
const Section = require('../../models/Section');
const Subject = require('../../models/Subject');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');

/**
 * School Service — business logic for school setup.
 * Handles Classes, Sections, and Subjects.
 */
class SchoolService {
  // ═══════════════════════════════════════════════════════════
  //  CLASSES
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a new class.
   * @param {Object} data - { name, code, description, order }
   * @returns {Object} created class
   */
  static async createClass(data) {
    // Check for duplicate class code
    const existing = await Class.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw new AppError(`Class with code '${data.code}' already exists`, 400);
    }

    const newClass = await Class.create(data);
    return newClass;
  }

  /**
   * Get all classes with optional filters.
   * @param {Object} query - { isActive, page, limit }
   * @returns {{ classes: Array, total: number }}
   */
  static async getClasses(query = {}) {
    const filter = {};
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    const [classes, total] = await Promise.all([
      Class.find(filter).sort({ order: 1 }).skip(skip).limit(limit),
      Class.countDocuments(filter),
    ]);

    return { classes, total, page, limit };
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a new section for a class.
   * @param {Object} data - { name, classId, capacity }
   * @returns {Object} created section
   */
  static async createSection(data) {
    // Verify class exists
    const classDoc = await Class.findById(data.classId);
    if (!classDoc) {
      throw new AppError('Class not found', 404);
    }

    // Check for duplicate section name within same class
    const existing = await Section.findOne({ name: data.name, classId: data.classId });
    if (existing) {
      throw new AppError(`Section '${data.name}' already exists in ${classDoc.name}`, 400);
    }

    const section = await Section.create(data);
    // Return with populated class
    return Section.findById(section._id).populate('classId', 'name code');
  }

  /**
   * Get all sections, optionally filtered by classId.
   * @param {Object} query - { classId, isActive, page, limit }
   * @returns {{ sections: Array, total: number }}
   */
  static async getSections(query = {}) {
    const filter = {};
    if (query.classId && mongoose.isValidObjectId(query.classId)) {
      filter.classId = query.classId;
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 100;
    const skip = (page - 1) * limit;

    const [sections, total] = await Promise.all([
      Section.find(filter)
        .populate('classId', 'name code')
        .sort({ classId: 1, name: 1 })
        .skip(skip)
        .limit(limit),
      Section.countDocuments(filter),
    ]);

    return { sections, total, page, limit };
  }

  // ═══════════════════════════════════════════════════════════
  //  SUBJECTS
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a new subject.
   * @param {Object} data - { name, code, type }
   * @returns {Object} created subject
   */
  static async createSubject(data) {
    // Check for duplicate subject code
    const existing = await Subject.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw new AppError(`Subject with code '${data.code}' already exists`, 400);
    }

    const subject = await Subject.create(data);
    return subject;
  }

  /**
   * Get all subjects with optional filters.
   * @param {Object} query - { type, isActive, page, limit }
   * @returns {{ subjects: Array, total: number }}
   */
  static async getSubjects(query = {}) {
    const filter = {};
    if (query.type) {
      filter.type = query.type;
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true';
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    const [subjects, total] = await Promise.all([
      Subject.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Subject.countDocuments(filter),
    ]);

    return { subjects, total, page, limit };
  }
}

module.exports = SchoolService;
