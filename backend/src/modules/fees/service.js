const FeeStructure = require('../../models/FeeStructure');
const FeePayment = require('../../models/FeePayment');
const FeeInvoice = require('../../models/FeeInvoice');
const Student = require('../../models/Student');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');
const ActivityService = require('../activity/service');
const NotificationService = require('../notification/service');

/**
 * Fees Service — business logic for fee structures, invoices, and payments.
 */
class FeesService {
  static async getModuleStatus() {
    return { module: 'fees', status: 'Fees module is operational' };
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE STRUCTURE
  // ═══════════════════════════════════════════════════════════

  static async createStructure({ classId, academicYear, academicYearId, totalAmount, installments }) {
    const SetupService = require('../setup/service');
    const resolvedYearId = await SetupService.resolveAcademicYearId(academicYearId || academicYear);

    const structure = await FeeStructure.findOneAndUpdate(
      { classId, academicYearId: resolvedYearId },
      { classId, academicYearId: resolvedYearId, totalAmount, installments },
      { new: true, upsert: true, runValidators: true }
    ).populate('classId', 'name code');

    return structure;
  }

  static async getStructures(filters = {}) {
    const query = {};
    if (filters.classId) query.classId = filters.classId;
    if (filters.academicYearId) query.academicYearId = filters.academicYearId;
    else if (filters.academicYear) query.academicYearId = filters.academicYear;

    return FeeStructure.find(query).populate('classId', 'name code').sort({ createdAt: -1 });
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE INVOICE (core)
  // ═══════════════════════════════════════════════════════════

  /**
   * Generate (or retrieve existing) FeeInvoice for a student.
   * Called automatically when student is created.
   * Safe to call multiple times — upsert ensures one invoice per student/year.
   *
   * @param {{ studentId, classId, academicYearId, feeStructureId }} params
   * @returns {FeeInvoice}
   */
  static async generateInvoice({ studentId, classId, academicYearId, feeStructureId }) {
    // Check for existing invoice
    const existing = await FeeInvoice.findOne({ studentId, academicYearId });
    if (existing) return existing;

    // Resolve fee structure
    let structure = null;
    if (feeStructureId) {
      structure = await FeeStructure.findById(feeStructureId);
    }
    if (!structure) {
      structure = await FeeStructure.findOne({ classId, academicYearId }).sort({ createdAt: -1 });
    }
    if (!structure) {
      throw new AppError(
        'Fee structure not found for this class and academic year. Please create it in Setup → Fee Setup.',
        400
      );

    }
    if (!structure.totalAmount || structure.totalAmount <= 0) {
      throw new AppError('Invalid fee structure: totalAmount must be greater than 0', 400);
    }

    // Build feeItems from installments
    const feeItems = (structure.installments || []).map((inst) => ({
      name: inst.name,
      amount: inst.amount,
      dueDate: inst.dueDate,
    }));

    // First installment due date or null
    const dueDate = feeItems.length > 0 ? feeItems[0].dueDate : null;

    const invoice = await FeeInvoice.create({
      studentId,
      classId,
      academicYearId: academicYearId || null,
      feeStructureId: structure._id || null,
      feeItems,
      totalAmount: structure.totalAmount,
      paidAmount: 0,
      dueAmount: structure.totalAmount,
      status: structure.totalAmount > 0 ? 'unpaid' : 'paid',
      dueDate,
    });

    return invoice;
  }

  /**
   * Get invoice for a student (+ academic year).
   */
  static async getInvoice(studentId, academicYearId) {
    const query = { studentId };
    if (academicYearId && mongoose.isValidObjectId(academicYearId)) query.academicYearId = academicYearId;
    return FeeInvoice.findOne(query)
      .populate('feeStructureId', 'totalAmount installments')
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .sort({ createdAt: -1 });
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE PAYMENTS
  // ═══════════════════════════════════════════════════════════

  /**
   * Record a fee payment for a student.
   * - Enforces overpay prevention via FeeInvoice
   * - Updates invoice paidAmount / dueAmount / status atomically
   * - Falls back to FeeStructure if no invoice exists (backward compat)
   */
  static async recordPayment({ studentId, amount, paymentMode, transactionId, invoiceId }) {
    if (!mongoose.isValidObjectId(studentId)) throw new AppError('Invalid student ID format', 400);

    const student = await Student.findById(studentId).populate('classId');
    if (!student) throw new AppError('Student not found', 404);

    // ─── Find or resolve invoice ───────────────────────────
    let invoice = null;
    if (invoiceId && mongoose.isValidObjectId(invoiceId)) {
      invoice = await FeeInvoice.findById(invoiceId);
    }
    if (!invoice) {
      // Try by studentId (latest active invoice)
      invoice = await FeeInvoice.findOne({ studentId }).sort({ createdAt: -1 });
    }

    // ─── Overpay prevention ────────────────────────────────
    if (invoice) {
      if (amount > invoice.dueAmount) {
        throw new AppError(
          `Cannot overpay. Due: ₹${invoice.dueAmount}, Max allowed: ₹${invoice.dueAmount}`,
          400
        );
      }
    } else {
      // Fallback to FeeStructure (backward compat for students without invoice)
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
    }

    // ─── Create payment record ─────────────────────────────
    const payment = await FeePayment.create({
      studentId,
      amount,
      paymentMode,
      transactionId: transactionId || null,
      invoiceId: invoice?._id || null,
      paidAt: new Date(),
    });

    // ─── Update invoice atomically ─────────────────────────
    if (invoice) {
      invoice.paidAmount = invoice.paidAmount + amount;
      invoice.dueAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
      if (invoice.paidAmount >= invoice.totalAmount) {
        invoice.status = 'paid';
      } else if (invoice.paidAmount > 0) {
        invoice.status = 'partial';
      }
      await invoice.save();
    }

    // Activity + notification (non-blocking)
    FeesService._triggerPaymentActivity(student, amount, paymentMode, payment.receiptNumber);
    FeesService._triggerPaymentNotification(student, amount, payment.receiptNumber);

    return { payment, invoice };
  }

  static _triggerPaymentActivity(student, amount, paymentMode, receiptNumber) {
    ActivityService.log({
      studentId: student._id,
      action: `Fee payment of ₹${amount} via ${paymentMode} (${receiptNumber})`,
      module: 'fee',
      metadata: { amount, paymentMode, receiptNumber, studentName: student.name },
    }).catch((e) => console.error('Activity log failed:', e.message));
  }

  static _triggerPaymentNotification(student, amount, receiptNumber) {
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

  // ═══════════════════════════════════════════════════════════
  //  STUDENT FEE DETAILS
  // ═══════════════════════════════════════════════════════════

  /**
   * Get full fee details for a student — invoice + payments + summary.
   * Returns { student, invoice, feeStructure, payments, summary }
   */
  static async getStudentFees(studentId) {
    if (!mongoose.isValidObjectId(studentId)) throw new AppError('Invalid student ID format', 400);

    const student = await Student.findById(studentId)
      .populate('classId', 'name code')
      .lean();
    if (!student) throw new AppError('Student not found', 404);

    // Fetch invoice (prefer invoice-based data)
    const invoice = await FeeInvoice.findOne({ studentId })
      .populate('feeStructureId', 'totalAmount installments')
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch fee structure (fallback)
    const feeStructure = invoice?.feeStructureId
      || await FeeStructure.findOne({ classId: student.classId._id }).sort({ createdAt: -1 }).lean();

    // Fetch all payments
    const payments = await FeePayment.find({ studentId }).sort({ paidAt: -1 }).lean();

    // Compute summary from invoice (preferred) or from structure+payments
    let totalFee, totalPaid, totalDue, status;
    if (invoice) {
      totalFee = invoice.totalAmount;
      totalPaid = invoice.paidAmount;
      totalDue = invoice.dueAmount;
      status = invoice.status === 'paid' ? 'Paid' : invoice.status === 'partial' ? 'Partial' : 'Pending';
    } else {
      totalFee = feeStructure ? feeStructure.totalAmount : 0;
      totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      totalDue = Math.max(0, totalFee - totalPaid);
      if (totalPaid >= totalFee && totalFee > 0) status = 'Paid';
      else if (totalPaid > 0) status = 'Partial';
      else status = 'Pending';
    }

    return {
      student,
      invoice,
      feeStructure,
      payments,
      summary: { totalFee, totalPaid, totalDue, status },
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  DUE LIST
  // ═══════════════════════════════════════════════════════════

  /**
   * Get list of students with unpaid or partial fees.
   * Filtered by classId, status (unpaid|partial|all).
   */
  static async getDueList(filters = {}) {
    const query = { status: { $in: ['unpaid', 'partial'] } };
    if (filters.status === 'unpaid') query.status = 'unpaid';
    else if (filters.status === 'partial') query.status = 'partial';

    if (filters.classId && mongoose.isValidObjectId(filters.classId)) {
      query.classId = filters.classId;
    }

    const invoices = await FeeInvoice.find(query)
      .populate('studentId', 'name rollNo parentPhone')
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .sort({ dueAmount: -1 })
      .lean();

    return invoices.map((inv) => ({
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      student: inv.studentId,
      class: inv.classId,
      academicYear: inv.academicYearId,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      dueAmount: inv.dueAmount,
      status: inv.status,
      dueDate: inv.dueDate,
    }));
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE OVERVIEW
  // ═══════════════════════════════════════════════════════════

  /**
   * Fee overview: if invoices exist use them, otherwise fall back to
   * per-student FeeStructure+FeePayment computation.
   */
  static async getFeeOverview(filters = {}) {
    const studentQuery = { isActive: true };
    if (filters.classId) studentQuery.classId = filters.classId;

    const students = await Student.find(studentQuery)
      .populate('classId', 'name code')
      .sort({ name: 1 })
      .lean();

    if (!students.length) return [];

    const studentIds = students.map((s) => s._id);
    const classIds = [...new Set(students.map((s) => s.classId?._id?.toString()))];

    // Load invoices for these students
    const invoices = await FeeInvoice.find({ studentId: { $in: studentIds } }).lean();
    const invoiceMap = {};
    for (const inv of invoices) {
      invoiceMap[inv.studentId.toString()] = inv;
    }

    // Load fee structures for fallback
    const structures = await FeeStructure.find({ classId: { $in: classIds } })
      .sort({ createdAt: -1 }).lean();
    const structureMap = {};
    for (const s of structures) {
      const key = s.classId.toString();
      if (!structureMap[key]) structureMap[key] = s;
    }

    // Load payments for fallback
    const payments = await FeePayment.find({ studentId: { $in: studentIds } }).lean();
    const paidMap = {};
    for (const p of payments) {
      const key = p.studentId.toString();
      paidMap[key] = (paidMap[key] || 0) + p.amount;
    }

    return students.map((student) => {
      const inv = invoiceMap[student._id.toString()];
      let totalFee, totalPaid, totalDue, status;

      if (inv) {
        totalFee = inv.totalAmount;
        totalPaid = inv.paidAmount;
        totalDue = inv.dueAmount;
        status = inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : 'Pending';
      } else {
        const struct = structureMap[student.classId?._id?.toString()];
        totalFee = struct ? struct.totalAmount : 0;
        totalPaid = paidMap[student._id.toString()] || 0;
        totalDue = Math.max(0, totalFee - totalPaid);
        if (totalPaid >= totalFee && totalFee > 0) status = 'Paid';
        else if (totalPaid > 0) status = 'Partial';
        else status = 'Pending';
      }

      return {
        _id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        className: student.classId?.name || '—',
        classId: student.classId?._id,
        invoiceId: inv?._id || null,
        invoiceNumber: inv?.invoiceNumber || null,
        totalFee,
        totalPaid,
        totalDue,
        status,
        dueDate: inv?.dueDate || null,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  APPLY FEE STRUCTURE TO CLASS (bulk invoice generation)
  // ═══════════════════════════════════════════════════════════

  /**
   * Generate invoices for ALL students in a class (+ optional section).
   * Idempotent — skips students who already have an invoice for the academic year.
   * @param {{ classId, academicYearId, sectionId? }} params
   * @returns {{ generated: number, skipped: number, total: number }}
   */
  static async applyStructureToClass({ classId, academicYearId, sectionId }) {
    if (!classId) throw new AppError('classId is required', 400);

    const SetupService = require('../setup/service');
    const resolvedYearId = await SetupService.resolveAcademicYearId(academicYearId);

    // Find the fee structure
    const structure = await FeeStructure.findOne({ classId, academicYearId: resolvedYearId })
      .sort({ createdAt: -1 });
    if (!structure) {
      throw new AppError('No fee structure found for this class and academic year', 404);
    }

    // Find matching students
    const studentQuery = { classId, isActive: true };
    if (sectionId && mongoose.isValidObjectId(sectionId)) studentQuery.sectionId = sectionId;

    const students = await Student.find(studentQuery).select('_id classId academicYearId feeStructureId').lean();
    if (!students.length) return { generated: 0, skipped: 0, total: 0 };

    let generated = 0;
    let skipped = 0;

    for (const student of students) {
      try {
        const existing = await FeeInvoice.findOne({
          studentId: student._id,
          academicYearId: resolvedYearId,
        });
        if (existing) { skipped++; continue; }

        await FeesService.generateInvoice({
          studentId: student._id,
          classId: student.classId,
          academicYearId: resolvedYearId,
          feeStructureId: structure._id,
        });
        generated++;
      } catch (e) {
        console.error(`Invoice generation failed for student ${student._id}:`, e.message);
      }
    }

    return { generated, skipped, total: students.length };
  }

  // ═══════════════════════════════════════════════════════════
  //  MANUAL PAYMENT (parent submits, admin approves/rejects)
  // ═══════════════════════════════════════════════════════════

  /**
   * Submit a manual payment (status = 'pending').
   * No invoice update until admin approves.
   */
  static async recordManualPayment({ studentId, amount, paymentMode, transactionId, proofUrl, invoiceId }) {
    if (!mongoose.isValidObjectId(studentId)) throw new AppError('Invalid student ID', 400);
    const student = await Student.findById(studentId);
    if (!student) throw new AppError('Student not found', 404);

    const payment = await FeePayment.create({
      studentId,
      amount,
      paymentMode: paymentMode || 'online',
      transactionId: transactionId || null,
      proofUrl: proofUrl || null,
      invoiceId: invoiceId || null,
      status: 'pending',
      paidAt: new Date(),
    });

    return payment;
  }

  /**
   * Admin approves a pending payment → updates invoice.
   */
  static async approvePayment(paymentId, adminUserId) {
    if (!mongoose.isValidObjectId(paymentId)) throw new AppError('Invalid payment ID', 400);

    const payment = await FeePayment.findById(paymentId);
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.status === 'approved') throw new AppError('Payment already approved', 400);
    if (payment.status === 'rejected') throw new AppError('Cannot approve a rejected payment', 400);

    payment.status = 'approved';
    await payment.save();

    // Update invoice if linked
    if (payment.invoiceId) {
      const invoice = await FeeInvoice.findById(payment.invoiceId);
      if (invoice) {
        invoice.paidAmount = invoice.paidAmount + payment.amount;
        invoice.dueAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
        invoice.status = invoice.paidAmount >= invoice.totalAmount ? 'paid' : 'partial';
        await invoice.save();
      }
    }

    return payment;
  }

  /**
   * Admin rejects a pending payment.
   */
  static async rejectPayment(paymentId, reason) {
    if (!mongoose.isValidObjectId(paymentId)) throw new AppError('Invalid payment ID', 400);

    const payment = await FeePayment.findById(paymentId);
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.status !== 'pending') throw new AppError('Only pending payments can be rejected', 400);

    payment.status = 'rejected';
    if (reason) payment.remarks = reason;
    await payment.save();

    return payment;
  }

  /**
   * Get all pending payments (admin view).
   */
  static async getPendingPayments(filters = {}) {
    const query = { status: 'pending' };
    if (filters.classId) {
      // Join through studentId
      const students = await Student.find({ classId: filters.classId }).select('_id').lean();
      query.studentId = { $in: students.map((s) => s._id) };
    }
    return FeePayment.find(query)
      .populate('studentId', 'name rollNo classId')
      .populate('invoiceId', 'invoiceNumber totalAmount')
      .sort({ paidAt: -1 })
      .lean();
  }
}

module.exports = FeesService;

