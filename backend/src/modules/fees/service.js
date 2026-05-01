const FeeStructure = require('../../models/FeeStructure');
const FeePayment = require('../../models/FeePayment');
const Student = require('../../models/Student');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');
const ActivityService = require('../activity/service');
const NotificationService = require('../notification/service');

/**
 * Fees Service — business logic for fee structures and payments.
 * All DB operations and data processing go here.
 */
class FeesService {
  /**
   * Get module operational status.
   * @returns {{ module: string, status: string }}
   */
  static async getModuleStatus() {
    return { module: 'fees', status: 'Fees module is operational' };
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE STRUCTURE
  // ═══════════════════════════════════════════════════════════

  /**
   * Create or update a fee structure for a class + academic year.
   * Uses upsert so that re-submitting for the same class/year updates
   * rather than creating a duplicate.
   * Supports both 'academicYearId' and legacy 'academicYear' param names.
   */
  static async createStructure({ classId, academicYear, academicYearId, totalAmount, installments }) {
    // Auto-resolve academic year (supports both old string param and new ObjectId)
    const SetupService = require('../setup/service');
    const resolvedYearId = await SetupService.resolveAcademicYearId(academicYearId || academicYear);

    const structure = await FeeStructure.findOneAndUpdate(
      { classId, academicYearId: resolvedYearId },
      { classId, academicYearId: resolvedYearId, totalAmount, installments },
      { new: true, upsert: true, runValidators: true }
    ).populate('classId', 'name code');

    return structure;
  }

  /**
   * Get all fee structures, optionally filtered by classId or academicYearId.
   */
  static async getStructures(filters = {}) {
    const query = {};
    if (filters.classId) query.classId = filters.classId;
    if (filters.academicYearId) query.academicYearId = filters.academicYearId;
    else if (filters.academicYear) query.academicYearId = filters.academicYear; // backward compat

    const structures = await FeeStructure.find(query)
      .populate('classId', 'name code')
      .sort({ createdAt: -1 });

    return structures;
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE PAYMENTS
  // ═══════════════════════════════════════════════════════════

  /**
   * Record a fee payment for a student.
   */
  static async recordPayment({ studentId, amount, paymentMode, transactionId }) {
    // Validate ObjectId
    if (!mongoose.isValidObjectId(studentId)) {
      throw new AppError('Invalid student ID format', 400);
    }

    // Ensure student exists
    const student = await Student.findById(studentId).populate('classId');
    if (!student) {
      throw new AppError('Student not found', 404);
    }

    // --- Overpay prevention ---
    const feeStructure = await FeeStructure.findOne({ classId: student.classId?._id })
      .sort({ createdAt: -1 }).lean();
    if (feeStructure) {
      const existingPayments = await FeePayment.find({ studentId }).lean();
      const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid + amount > feeStructure.totalAmount) {
        const maxAllowed = feeStructure.totalAmount - totalPaid;
        throw new AppError(
          `Cannot overpay. Total fee: ₹${feeStructure.totalAmount}, Already paid: ₹${totalPaid}. Max allowed: ₹${maxAllowed}`,
          400
        );
      }
    }

    const payment = await FeePayment.create({
      studentId,
      amount,
      paymentMode,
      transactionId: transactionId || null,
      paidAt: new Date(),
    });

    // Fire activity + notification (non-blocking)
    FeesService._triggerPaymentActivity(student, amount, paymentMode, payment.receiptNumber);
    FeesService._triggerPaymentNotification(student, amount, payment.receiptNumber);

    return payment;
  }

  /**
   * Fire activity log for a fee payment (non-blocking).
   */
  static _triggerPaymentActivity(student, amount, paymentMode, receiptNumber) {
    ActivityService.log({
      studentId: student._id,
      action: `Fee payment of ₹${amount} via ${paymentMode} (${receiptNumber})`,
      module: 'fee',
      metadata: { amount, paymentMode, receiptNumber, studentName: student.name },
    }).catch((e) => console.error('Activity log failed:', e.message));
  }

  /**
   * Notify parent about fee payment (non-blocking).
   */
  static _triggerPaymentNotification(student, amount, receiptNumber) {
    // Find parent via student.parentId
    if (!student.parentId) return;
    const Parent = require('../../models/Parent');
    Parent.findById(student.parentId).then((parent) => {
      if (!parent?.userId) return;
      NotificationService.create(parent.userId, {
        title: 'Fee Payment Received',
        message: `₹${amount} paid for ${student.name}. Receipt: ${receiptNumber}`,
        type: 'info',
        metadata: { studentId: student._id, amount, receiptNumber },
      });
    }).catch((e) => console.error('Payment notification failed:', e.message));
  }

  /**
   * Get all payments for a specific student, along with computed fee summary.
   * Returns { student, feeStructure, payments, summary }.
   */
  static async getStudentFees(studentId) {
    // Validate ObjectId
    if (!mongoose.isValidObjectId(studentId)) {
      throw new AppError('Invalid student ID format', 400);
    }

    // Fetch the student with class info
    const student = await Student.findById(studentId)
      .populate('classId', 'name code')
      .lean();

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    // Fetch fee structure for the student's class (latest academic year)
    const feeStructure = await FeeStructure.findOne({ classId: student.classId._id })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch all payments for this student
    const payments = await FeePayment.find({ studentId })
      .sort({ paidAt: -1 })
      .lean();

    // Compute summary
    const totalFee = feeStructure ? feeStructure.totalAmount : 0;
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalDue = Math.max(0, totalFee - totalPaid);

    let status = 'Pending';
    if (totalPaid >= totalFee && totalFee > 0) status = 'Paid';
    else if (totalPaid > 0) status = 'Partial';

    return {
      student,
      feeStructure,
      payments,
      summary: { totalFee, totalPaid, totalDue, status },
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE OVERVIEW — for the fees table page
  // ═══════════════════════════════════════════════════════════

  /**
   * Get fee overview for all students (or filtered by class).
   * Returns an array of { student, className, totalFee, totalPaid, totalDue, status }.
   */
  static async getFeeOverview(filters = {}) {
    const studentQuery = { isActive: true };
    if (filters.classId) studentQuery.classId = filters.classId;

    const students = await Student.find(studentQuery)
      .populate('classId', 'name code')
      .sort({ name: 1 })
      .lean();

    if (!students.length) return [];

    // Get distinct class IDs
    const classIds = [...new Set(students.map((s) => s.classId?._id?.toString()))];

    // Fetch fee structures for all relevant classes
    const structures = await FeeStructure.find({ classId: { $in: classIds } })
      .sort({ createdAt: -1 })
      .lean();

    // Map: classId → latest fee structure
    const structureMap = {};
    for (const s of structures) {
      const key = s.classId.toString();
      if (!structureMap[key]) structureMap[key] = s;
    }

    // Fetch all payments for these students
    const studentIds = students.map((s) => s._id);
    const payments = await FeePayment.find({ studentId: { $in: studentIds } }).lean();

    // Map: studentId → total paid
    const paidMap = {};
    for (const p of payments) {
      const key = p.studentId.toString();
      paidMap[key] = (paidMap[key] || 0) + p.amount;
    }

    // Build overview
    const overview = students.map((student) => {
      const classKey = student.classId?._id?.toString();
      const structure = classKey ? structureMap[classKey] : null;
      const totalFee = structure ? structure.totalAmount : 0;
      const totalPaid = paidMap[student._id.toString()] || 0;
      const totalDue = Math.max(0, totalFee - totalPaid);

      let status = 'Pending';
      if (totalPaid >= totalFee && totalFee > 0) status = 'Paid';
      else if (totalPaid > 0) status = 'Partial';

      return {
        _id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        className: student.classId?.name || '—',
        classId: student.classId?._id,
        totalFee,
        totalPaid,
        totalDue,
        status,
      };
    });

    return overview;
  }
}

module.exports = FeesService;
