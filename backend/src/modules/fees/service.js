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

  /**
   * Build installments array from auto-split parameters.
   * @param {{ totalAmount, installmentCount, startDate, frequency }} params
   * @returns {Array} installments
   */
  static _autoSplitInstallments({ totalAmount, installmentCount, startDate, frequency = 'monthly' }) {
    if (!installmentCount || installmentCount < 1) {
      throw new AppError('installmentCount must be >= 1', 400);
    }
    if (!startDate) throw new AppError('startDate is required for auto split', 400);
    if (!totalAmount || totalAmount <= 0) throw new AppError('totalAmount must be > 0', 400);

    const base = Math.floor(totalAmount / installmentCount);
    const rem = totalAmount - base * installmentCount; // rounding remainder
    const months = frequency === 'quarterly' ? 3 : 1;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) throw new AppError('Invalid startDate', 400);

    return Array.from({ length: installmentCount }, (_, i) => {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i * months);
      const amount = i === installmentCount - 1 ? base + rem : base; // last absorbs rounding
      const ordinals = ['1st', '2nd', '3rd'];
      const label = ordinals[i] || `${i + 1}th`;
      return {
        name: `${label} Installment`,
        amount,
        dueDate: due,
        paidAmount: 0,
        status: 'pending',
      };
    });
  }

  /**
   * Create or update a fee structure for a class + academic year.
   * Accepts:
   *   A) Manual installments array
   *   B) Auto-split params: { installmentCount, startDate, frequency }
   */
  static async createStructure(data) {
    const {
      classId, academicYear, academicYearId,
      totalAmount, installments,
      feeGroupId,
      installmentCount, startDate, frequency,
    } = data;

    if (!classId) throw new AppError('classId is required', 400);
    if (!totalAmount) throw new AppError('totalAmount is required', 400);

    const SetupService = require('../setup/service');
    const resolvedYearId = await SetupService.resolveAcademicYearId(academicYearId || academicYear);

    // ── FeeGroup validation (optional but must exist if provided) ──
    if (feeGroupId) {
      const FeeGroup = require('../../models/FeeGroup');
      const grp = await FeeGroup.findById(feeGroupId);
      if (!grp) throw new AppError('FeeGroup not found', 404);
    }

    // ── Resolve installments ───────────────────────────────────
    let resolvedInstallments = installments;

    if (!resolvedInstallments || resolvedInstallments.length === 0) {
      // Auto-split mode
      if (installmentCount && installmentCount > 0) {
        resolvedInstallments = FeesService._autoSplitInstallments({
          totalAmount,
          installmentCount,
          startDate,
          frequency,
        });
      } else {
        // Single-installment fallback — no breakdown
        resolvedInstallments = [];
      }
    } else {
      // Manual installments: validate sum
      const sum = resolvedInstallments.reduce((acc, inst) => acc + Number(inst.amount), 0);
      if (Math.abs(sum - totalAmount) > 1) {
        throw new AppError(
          `Installment amounts (₹${sum}) must equal totalAmount (₹${totalAmount})`,
          400
        );
      }
      // Ensure paidAmount/status defaults for new installments
      resolvedInstallments = resolvedInstallments.map((inst) => ({
        ...inst,
        paidAmount: inst.paidAmount || 0,
        status: inst.status || 'pending',
      }));
    }

    const structure = await FeeStructure.findOneAndUpdate(
      { classId, academicYearId: resolvedYearId },
      {
        classId,
        academicYearId: resolvedYearId,
        totalAmount,
        installments: resolvedInstallments,
        feeGroupId: feeGroupId || null,
      },
      { new: true, upsert: true, runValidators: true }
    ).populate('classId', 'name code').populate('feeGroupId', 'name');

    return structure;
  }

  static async getStructures(filters = {}) {
    const query = {};
    if (filters.classId) query.classId = filters.classId;
    if (filters.academicYearId) query.academicYearId = filters.academicYearId;
    else if (filters.academicYear) query.academicYearId = filters.academicYear;

    return FeeStructure.find(query)
      .populate('classId', 'name code')
      .populate('feeGroupId', 'name')
      .sort({ createdAt: -1 });
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
   * - Applies payment to earliest unpaid installments in FeeStructure
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

    // ─── Apply payment to installments in FeeStructure ────
    await FeesService._applyPaymentToInstallments(student.classId?._id, invoice?.academicYearId, amount);

    // Activity + notification (non-blocking)
    FeesService._triggerPaymentActivity(student, amount, paymentMode, payment.receiptNumber);
    FeesService._triggerPaymentNotification(student, amount, payment.receiptNumber);

    return { payment, invoice };
  }

  /**
   * Apply payment amount to earliest pending/partial installments in the FeeStructure.
   * Mutates FeeStructure installment paidAmount and status in-place.
   * @param {ObjectId} classId
   * @param {ObjectId} academicYearId
   * @param {number} amount
   */
  static async _applyPaymentToInstallments(classId, academicYearId, amount) {
    if (!classId) return;
    try {
      const query = { classId };
      if (academicYearId && mongoose.isValidObjectId(academicYearId?.toString()))
        query.academicYearId = academicYearId;

      const structure = await FeeStructure.findOne(query).sort({ createdAt: -1 });
      if (!structure || !structure.installments?.length) return;

      let remaining = amount;
      const today = new Date();

      for (const inst of structure.installments) {
        if (remaining <= 0) break;
        if (inst.status === 'paid') continue;

        const outstanding = inst.amount - inst.paidAmount;
        const toApply = Math.min(remaining, outstanding);
        inst.paidAmount += toApply;
        remaining -= toApply;

        if (inst.paidAmount >= inst.amount) {
          inst.status = 'paid';
        } else if (inst.paidAmount > 0) {
          inst.status = 'partial';
        } else if (inst.dueDate && today > new Date(inst.dueDate)) {
          inst.status = 'overdue';
        } else {
          inst.status = 'pending';
        }
      }

      // Bypass the sum-validation hook on partial updates
      await FeeStructure.findByIdAndUpdate(structure._id, {
        installments: structure.installments,
      });
    } catch (e) {
      console.error('Installment update failed (non-blocking):', e.message);
    }
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
   * Get full fee details for a student — invoice + payments + installment breakdown + summary.
   * Returns { student, invoice, feeStructure, payments, installments, summary }
   */
  static async getStudentFees(studentId) {
    if (!mongoose.isValidObjectId(studentId)) throw new AppError('Invalid student ID format', 400);

    const student = await Student.findById(studentId)
      .populate('classId', 'name code')
      .lean();
    if (!student) throw new AppError('Student not found', 404);

    // Fetch invoice (prefer invoice-based data)
    const invoice = await FeeInvoice.findOne({ studentId })
      .populate('feeStructureId', 'totalAmount installments feeGroupId')
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch fee structure (fallback or for installment detail)
    const feeStructure = invoice?.feeStructureId
      || await FeeStructure.findOne({ classId: student.classId._id })
        .sort({ createdAt: -1 })
        .populate('feeGroupId', 'name')
        .lean();

    // Fetch all approved payments
    const payments = await FeePayment.find({ studentId, status: { $ne: 'rejected' } })
      .sort({ paidAt: -1 }).lean();

    // ── Installment breakdown ──────────────────────────────
    const rawInstallments = feeStructure?.installments || [];
    const installments = rawInstallments.map((inst) => ({
      _id: inst._id,
      name: inst.name,
      amount: inst.amount,
      dueDate: inst.dueDate,
      paidAmount: inst.paidAmount || 0,
      due: Math.max(0, inst.amount - (inst.paidAmount || 0)),
      status: inst.status || (inst.paidAmount >= inst.amount ? 'paid' : inst.paidAmount > 0 ? 'partial' : 'pending'),
      overdue: inst.dueDate && new Date(inst.dueDate) < new Date() && inst.status !== 'paid',
    }));

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
      installments,
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

  // ═══════════════════════════════════════════════════════════
  //  PENALTY ENGINE
  // ═══════════════════════════════════════════════════════════

  /**
   * Calculate and apply late fee to an invoice.
   * @param {string} invoiceId
   * @param {{ type: 'fixed'|'percent', value: number }} overrideConfig - optional override
   */
  static async applyPenalty(invoiceId, overrideConfig, userId) {
    const invoice = await FeeInvoice.findById(invoiceId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.locked) throw new AppError('Invoice is locked. Cannot modify.', 403);
    if (invoice.status === 'paid') throw new AppError('Invoice is fully paid. No penalty applicable.', 400);

    const config = overrideConfig || {};
    let penaltyAmt = 0;

    if (config.type === 'percent') {
      penaltyAmt = Math.round((invoice.dueAmount * config.value) / 100);
    } else {
      penaltyAmt = config.value || 0;
    }

    if (penaltyAmt <= 0) throw new AppError('Penalty amount must be greater than 0', 400);

    invoice.penaltyAmount = (invoice.penaltyAmount || 0) + penaltyAmt;
    await invoice.save();

    ActivityService.log({
      studentId: invoice.studentId,
      action: `Penalty of ₹${penaltyAmt} applied to invoice ${invoice.invoiceNumber}`,
      module: 'fee',
      metadata: { invoiceId, penaltyAmt, userId },
    }).catch(() => {});

    return invoice;
  }

  /**
   * Waive penalty (partially or fully) on an invoice.
   */
  static async waivePenalty(invoiceId, { waiveAmount, reason }, userId) {
    const invoice = await FeeInvoice.findById(invoiceId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (!invoice.penaltyAmount || invoice.penaltyAmount <= 0) {
      throw new AppError('No penalty to waive on this invoice', 400);
    }

    const toWaive = Math.min(waiveAmount || invoice.penaltyAmount, invoice.penaltyAmount);
    invoice.penaltyAmount -= toWaive;
    invoice.waivedAmount  = (invoice.waivedAmount || 0) + toWaive;
    invoice.waivedBy      = userId;
    invoice.waivedReason  = reason || '';
    invoice.waivedAt      = new Date();
    await invoice.save();

    ActivityService.log({
      studentId: invoice.studentId,
      action: `Penalty of ₹${toWaive} waived on invoice ${invoice.invoiceNumber}. Reason: ${reason || 'N/A'}`,
      module: 'fee',
      metadata: { invoiceId, toWaive, reason, userId },
    }).catch(() => {});

    return invoice;
  }

  // ═══════════════════════════════════════════════════════════
  //  INVOICE LOCKING
  // ═══════════════════════════════════════════════════════════

  static async lockInvoice(invoiceId, userId) {
    const invoice = await FeeInvoice.findById(invoiceId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.locked) throw new AppError('Invoice is already locked', 400);

    invoice.locked   = true;
    invoice.lockedAt = new Date();
    invoice.lockedBy = userId;
    await invoice.save();
    return invoice;
  }

  static async unlockInvoice(invoiceId, userId) {
    const invoice = await FeeInvoice.findById(invoiceId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (!invoice.locked) throw new AppError('Invoice is not locked', 400);

    invoice.locked     = false;
    invoice.unlockedAt = new Date();
    invoice.unlockedBy = userId;
    await invoice.save();
    return invoice;
  }

  // ═══════════════════════════════════════════════════════════
  //  INSTALLMENT PAYMENT (student-wise invoice)
  // ═══════════════════════════════════════════════════════════

  /**
   * Record payment against a specific installment in a FeeInvoice.
   */
  static async recordInstallmentPayment({ invoiceId, installmentId, amount, paymentMode, transactionId, userId }) {
    const invoice = await FeeInvoice.findById(invoiceId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.locked) throw new AppError('Invoice is locked. Cannot record payment.', 403);
    if (invoice.status === 'paid') throw new AppError('Invoice is already fully paid', 400);

    let targetInstallment = null;
    if (installmentId) {
      targetInstallment = invoice.installments.id(installmentId);
    }
    // Fallback to first pending installment
    if (!targetInstallment) {
      targetInstallment = invoice.installments.find(i => i.status !== 'paid');
    }

    if (!targetInstallment) {
      // No installments — treat as full payment
      if (amount > invoice.dueAmount) {
        throw new AppError(`Cannot overpay. Due: ₹${invoice.dueAmount}`, 400);
      }
    } else {
      const remaining = targetInstallment.amount - (targetInstallment.paidAmount || 0);
      if (amount > remaining) {
        throw new AppError(`Amount exceeds installment due of ₹${remaining}`, 400);
      }
    }

    // Create payment record
    const student = await Student.findById(invoice.studentId);
    const payment = await FeePayment.create({
      studentId:     invoice.studentId,
      amount,
      paymentMode,
      transactionId: transactionId || null,
      invoiceId:     invoice._id,
      installmentId: targetInstallment?._id || null,
      installmentNo: targetInstallment?.installmentNo || null,
      collectedBy:   userId,
      status:        'approved',
      paidAt:        new Date(),
    });

    // Update installment
    if (targetInstallment) {
      targetInstallment.paidAmount  = (targetInstallment.paidAmount || 0) + amount;
      targetInstallment.paidAt      = new Date();
      targetInstallment.paymentMode = paymentMode;
      targetInstallment.receiptNumber = payment.receiptNumber;
      targetInstallment.collectedBy   = userId;
      targetInstallment.transactionId = transactionId || null;
      if (targetInstallment.paidAmount >= targetInstallment.amount) {
        targetInstallment.status = 'paid';
      } else {
        targetInstallment.status = 'partial';
      }
    }

    // Update invoice totals
    invoice.paidAmount = (invoice.paidAmount || 0) + amount;
    await invoice.save(); // pre-save hook updates dueAmount + status

    // Notify parent
    if (student?.parentId) {
      const Parent = require('../../models/Parent');
      Parent.findById(student.parentId).then((parent) => {
        if (!parent?.userId) return;
        NotificationService.create(parent.userId, {
          title:   'Fee Payment Received',
          message: `₹${amount} paid for ${student.name}. Receipt: ${payment.receiptNumber}`,
          type:    'info',
          metadata: { studentId: student._id, amount, receiptNumber: payment.receiptNumber },
        });
      }).catch(() => {});
    }

    return { payment, invoice };
  }

  // ═══════════════════════════════════════════════════════════
  //  ENHANCED STUDENT FEES (includes profile data)
  // ═══════════════════════════════════════════════════════════

  /**
   * Enhanced getStudentFees — includes StudentFeeProfile if it exists.
   * Backward compatible with old class-wise invoice system.
   */
  static async getEnhancedStudentFees(studentId) {
    if (!mongoose.isValidObjectId(studentId)) throw new AppError('Invalid student ID', 400);

    const baseData = await FeesService.getStudentFees(studentId);

    // Also try to load the StudentFeeProfile
    const StudentFeeProfile = require('../../models/StudentFeeProfile');
    const profile = await StudentFeeProfile.findOne({ studentId })
      .populate('selectedComponents.componentId', 'name code amount mandatory recurringType lateFeeConfig')
      .populate('discounts.approvedBy', 'name')
      .populate('lockedBy', 'name')
      .lean();

    return { ...baseData, feeProfile: profile || null };
  }
}

module.exports = FeesService;

