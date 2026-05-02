const Exam = require('../../models/Exam');
const Mark = require('../../models/Mark');
const Student = require('../../models/Student');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');
const ActivityService = require('../activity/service');

/**
 * Exam Service — business logic for exams and marks.
 * All DB operations and data processing go here.
 */
class ExamService {
  /**
   * Get module operational status.
   */
  static async getModuleStatus() {
    return { module: 'exam', status: 'Exam module is operational' };
  }

  /**
   * Get subjects configured for a class via ClassConfig.
   * Falls back to all subjects if ClassConfig not set up.
   * @param {string} classId
   * @returns {Array} subject documents
   */
  static async getSubjectsForClass(classId) {
    const ClassConfig = require('../../models/ClassConfig');
    const Subject = require('../../models/Subject');

    const config = await ClassConfig.findOne({ classId }).sort({ createdAt: -1 });
    if (config && config.subjects && config.subjects.length > 0) {
      return Subject.find({ _id: { $in: config.subjects } }).select('name code').sort({ name: 1 });
    }
    // Fallback: return all subjects
    return Subject.find().select('name code').sort({ name: 1 }).limit(100);
  }


  //  EXAMS
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a new exam.
   * Auto-resolves academicYearId if not provided.
   * Validates subjects belong to the class via ClassConfig (if configured).
   */
  static async createExam(data) {
    // Auto-resolve academic year
    const SetupService = require('../setup/service');
    data.academicYearId = await SetupService.resolveAcademicYearId(data.academicYearId);

    // Validate class is configured for this year (graceful)
    await SetupService.validateClassForYear(data.classId, data.academicYearId);

    // Normalize subjects: accept both plain IDs and {subjectId, maxMarks, passingMarks} objects
    if (data.subjects && data.subjects.length > 0) {
      const globalMax = data.maxMarks || 100;
      const globalPassing = data.passingMarks || 0;
      data.subjects = data.subjects.map((s) => {
        if (typeof s === 'string' || (s && !s.subjectId)) {
          // Plain MongoId string or bare object — wrap to schema shape
          return { subjectId: s.toString ? s.toString() : s, maxMarks: globalMax, passingMarks: globalPassing };
        }
        // Already { subjectId, maxMarks, passingMarks }
        return { subjectId: s.subjectId, maxMarks: s.maxMarks || globalMax, passingMarks: s.passingMarks ?? globalPassing };
      });

      const subjectIds = data.subjects.map((s) => s.subjectId);
      await SetupService.validateSubjectsForClass(subjectIds, data.classId, data.academicYearId);
    }

    const exam = await Exam.create(data);
    return exam.populate([
      { path: 'classId', select: 'name code' },
      { path: 'subjects.subjectId', select: 'name code' },
    ]);
  }

  /**
   * Get all exams, optionally filtered by classId or academicYearId.
   * Supports both old ?academicYear=string and new ?academicYearId=objectId filters.
   */
  static async getExams(filters = {}) {
    const query = {};
    if (filters.classId && mongoose.isValidObjectId(filters.classId)) {
      query.classId = filters.classId;
    }
    if (filters.academicYearId && mongoose.isValidObjectId(filters.academicYearId)) {
      query.academicYearId = filters.academicYearId;
    }

    const exams = await Exam.find(query)
      .populate('classId', 'name code')
      .populate('subjects.subjectId', 'name code')
      .sort({ createdAt: -1 });

    return exams;
  }

  /**
   * Get a single exam by ID with full details.
   */
  static async getExamById(examId) {
    const exam = await Exam.findById(examId)
      .populate('classId', 'name code')
      .populate('subjects.subjectId', 'name code');

    if (!exam) throw new AppError('Exam not found', 404);
    return exam;
  }

  // ═══════════════════════════════════════════════════════════
  //  MARKS
  // ═══════════════════════════════════════════════════════════

  /**
   * Save marks in bulk for an exam.
   * Uses bulkWrite with upsert for idempotent re-submissions.
   * maxMarks is resolved per-subject from Exam.subjects[].
   * @param {string} examId
   * @param {Array} marks - [{ studentId, subjectId, marksObtained }]
   */
  static async saveMarks(examId, marks) {
    const exam = await Exam.findById(examId);
    if (!exam) throw new AppError('Exam not found', 404);

    const ops = [];
    for (const m of marks) {
      // Find subject config in exam
      const examSubject = exam.subjects.find(
        (s) => s.subjectId && s.subjectId.toString() === m.subjectId.toString()
      );

      // For old exams that may not have subjects array, fall back to global maxMarks
      const subjectMaxMarks = examSubject ? examSubject.maxMarks : (exam.maxMarks || 100);

      ops.push({
        updateOne: {
          filter: {
            examId: new mongoose.Types.ObjectId(examId),
            studentId: new mongoose.Types.ObjectId(m.studentId),
            subjectId: new mongoose.Types.ObjectId(m.subjectId),
          },
          update: {
            $set: {
              examId,
              studentId: m.studentId,
              subjectId: m.subjectId,
              marksObtained: m.marksObtained,
              maxMarks: subjectMaxMarks,
              grade: ExamService._computeGrade(m.marksObtained, subjectMaxMarks),
            },
          },
          upsert: true,
        },
      });
    }

    const result = await Mark.bulkWrite(ops);

    // Activity log — one entry per exam marks batch (non-blocking)
    ActivityService.log({
      action: `Marks entered for ${marks.length} students in exam: ${exam.name}`,
      module: 'exam',
      metadata: { examId, examName: exam.name, count: marks.length },
    }).catch((e) => console.error('Activity log failed:', e.message));

    return {
      saved: result.upsertedCount || 0,
      updated: result.modifiedCount || 0,
      total: marks.length,
    };
  }

  /**
   * Get all marks for an exam, grouped by student.
   */
  static async getExamMarks(examId) {
    const exam = await Exam.findById(examId)
      .populate('classId', 'name code')
      .populate('subjects.subjectId', 'name code')
      .lean();

    if (!exam) throw new AppError('Exam not found', 404);

    const marks = await Mark.find({ examId })
      .populate('studentId', 'name rollNo')
      .populate('subjectId', 'name code')
      .sort({ 'studentId.rollNo': 1 })
      .lean();

    return { exam, marks };
  }

  // ═══════════════════════════════════════════════════════════
  //  STUDENT RESULTS
  // ═══════════════════════════════════════════════════════════

  /**
   * Get complete results for a student across all exams.
   * Returns per-exam breakdown with subjects, total, percentage, pass/fail.
   * Pass/Fail logic: FAIL if ANY subject < its passingMarks.
   */
  static async getStudentResults(studentId) {
    const student = await Student.findById(studentId)
      .populate('classId', 'name code')
      .lean();

    if (!student) throw new AppError('Student not found', 404);

    // All marks for this student
    const marks = await Mark.find({ studentId })
      .populate({
        path: 'examId',
        select: 'name academicYearId maxMarks passingMarks classId subjects',
        populate: { path: 'classId', select: 'name' },
      })
      .populate('subjectId', 'name code')
      .sort({ 'examId.createdAt': -1 })
      .lean();

    // Group marks by exam
    const examMap = {};
    for (const m of marks) {
      if (!m.examId) continue; // Safety: skip orphaned marks
      const eid = m.examId._id.toString();
      if (!examMap[eid]) {
        examMap[eid] = {
          exam: m.examId,
          subjects: [],
          totalObtained: 0,
          totalMax: 0,
        };
      }
      examMap[eid].subjects.push({
        subject: m.subjectId,
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        grade: m.grade,
      });
      examMap[eid].totalObtained += m.marksObtained;
      examMap[eid].totalMax += m.maxMarks;
    }

    // Build results array
    const results = await Promise.all(Object.values(examMap).map(async (entry) => {
      const percentage = entry.totalMax > 0
        ? Math.round((entry.totalObtained / entry.totalMax) * 100 * 10) / 10
        : 0;

      // Determine pass/fail per subject using per-subject passingMarks from exam config
      const examSubjects = entry.exam.subjects || [];
      const globalPassing = entry.exam.passingMarks || 0;

      const passed = entry.subjects.every((s) => {
        const examSubjectConfig = examSubjects.find(
          (es) => es.subjectId && s.subject && es.subjectId.toString() === s.subject._id.toString()
        );
        const passingThreshold = examSubjectConfig ? (examSubjectConfig.passingMarks || globalPassing) : globalPassing;
        return s.marksObtained >= passingThreshold;
      });

      // Dynamic overall grade based on percentage
      const overallGrade = await ExamService._computeGradeDynamic(entry.totalObtained, entry.totalMax);

      return {
        exam: {
          _id: entry.exam._id,
          name: entry.exam.name,
          academicYearId: entry.exam.academicYearId,
          className: entry.exam.classId?.name,
        },
        subjects: entry.subjects,
        totalObtained: entry.totalObtained,
        totalMax: entry.totalMax,
        percentage,
        grade: overallGrade,
        result: passed ? 'Pass' : 'Fail',
      };
    }));

    return { student, results };
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Compute grade using dynamic GradeConfig from Setup.
   * Falls back to hardcoded tiers if no GradeConfig records exist.
   * @param {number} obtained
   * @param {number} max
   * @returns {string} grade label
   */
  static async _computeGradeDynamic(obtained, max) {
    if (max <= 0) return 'N/A';
    const pct = (obtained / max) * 100;
    try {
      const GradeConfig = require('../../models/GradeConfig');
      const grades = await GradeConfig.find().sort({ minMarks: -1 }); // highest first
      if (grades.length > 0) {
        // GradeConfig stores absolute marks; convert pct to percentage-based match
        // minMarks and maxMarks in GradeConfig are percentage thresholds (0-100)
        const matched = grades.find((g) => pct >= g.minMarks && pct <= g.maxMarks);
        return matched ? matched.name : 'F';
      }
    } catch (e) {
      // GradeConfig not available — fall through to defaults
    }
    // Default fallback
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
  }

  /**
   * Synchronous grade compute (used in saveMarks bulkWrite context).
   * Uses hardcoded fallback only — async version used in results.
   */
  static _computeGrade(obtained, max) {
    if (max <= 0) return 'N/A';
    const pct = (obtained / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
  }
}

module.exports = ExamService;
