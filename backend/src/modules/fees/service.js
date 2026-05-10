// FeeStructure is kept as a lazy import ONLY for backward-compat reads on legacy invoices.
// All NEW operations use StudentFeeProfile as the single source of truth.
const FeePayment = require('../../models/FeePayment');
const FeeInvoice = require('../../models/FeeInvoice');
const Student = require('../../models/Student');
const AppError = require('../../utils/AppError');
const mongoose = require('mongoose');
const ActivityService = require('../activity/service');
const NotificationService = require('../notification/service');
const StudentFeeProfile = require('../../models/StudentFeeProfile');

/**
 * Fees Service — business logic for fee structures, invoices, and payments.
 */
class FeesService {
  static async getModuleStatus() {
    return { module: 'fees', status: 'Fees module is operational' };
  }


  // ═══════════════════════════════════════════════════════════
  //  FEE INVOICE (core)
  // ═══════════════════════════════════════════════════════════

  /**
   * Generate (or retrieve existing) FeeInvoice for a student.
   * SOURCE OF TRUTH: StudentFeeProfile — installments, amounts, discounts.
   * Safe to call multiple times — idempotent (one invoice per student/year).
   *
   * @param {{ studentId, classId, academicYearId }} params
   * @returns {FeeInvoice}
   */
  static async generateInvoice({ studentId, classId, academicYearId }) {
    // Idempotent — return existing if present
    const existing = await FeeInvoice.findOne({ studentId, academicYearId });
    if (existing) return existing;

    // Resolve the StudentFeeProfile (must exist before generating invoice)
    const profile = await StudentFeeProfile.findOne({ studentId, academicYearId }).sort({ createdAt: -1 });
    if (!profile) {
      throw new AppError(
        'No fee profile found for this student. Please assign fee components first in Fees → Assign Fees.',
        400
      );
    }
    if (!profile.grossFee || profile.grossFee <= 0) {
      throw new AppError('Fee profile has no components assigned. Total fee is Rs.0.', 400);
    }

    // ── Build invoice installments from profile schedule ──────────────────
    const now = new Date();
    const scheduleInstallments = (profile.installments || []).map((inst, i) => ({
      installmentNo: inst.installmentNo || i + 1,
      label:         inst.label,
      amount:        inst.amount,
      dueDate:       inst.dueDate || null,
      paidAmount:    0,
      status:        inst.dueDate && new Date(inst.dueDate) < now ? 'overdue' : 'pending',
    }));

    // ── Build legacy feeItems (backward-compat) ───────────────────────────
    const feeItems = (profile.selectedComponents || []).map(c => ({
      name:   c.name,
      amount: c.amount,
    }));

    // ── Compute due dates ─────────────────────────────────────────────────
    const dueDates = scheduleInstallments
      .filter(i => i.dueDate)
      .map(i => new Date(i.dueDate))
      .sort((a, b) => a - b);
    const dueDate    = dueDates[0] || null;
    const nextDueDate = FeesService._computeNextDueDate(scheduleInstallments);

    const totalAmount    = profile.grossFee;
    const discountAmount = profile.discountAmt;

    const invoice = await FeeInvoice.create({
      studentId,
      classId,
      academicYearId:  academicYearId || null,
      feeProfileId:    profile._id,
      feeItems,
      installments:    scheduleInstallments,
      totalAmount,
      discountAmount,
      paidAmount:      0,
      dueAmount:       Math.max(0, totalAmount - discountAmount),
      status:          'unpaid',
      dueDate,
      nextDueDate,
    });

    return invoice;
  }

  /**
   * Compute the next upcoming unpaid installment dueDate from an installments array.
   * Returns null if no future unpaid installments exist.
   * @param {Array} installments
   * @returns {Date|null}
   */
  static _computeNextDueDate(installments) {
    if (!Array.isArray(installments) || !installments.length) return null;
    const now = new Date();
    const upcoming = installments
      .filter(i => i.status !== 'paid' && i.dueDate && new Date(i.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return upcoming[0]?.dueDate || null;
  }


  /**
   * Get invoice for a student (+ academic year).
   */
  static async getInvoice(studentId, academicYearId) {
    const query = { studentId };
    if (academicYearId && mongoose.isValidObjectId(academicYearId)) query.academicYearId = academicYearId;
    return FeeInvoice.findOne(query)
      .populate('feeProfileId')
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
    // Fallback to FeePayments (backward compat for students without invoice)
      const existingPayments = await FeePayment.find({ studentId }).lean();
      const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
      const feeProfile = await StudentFeeProfile.findOne({ studentId }).sort({ createdAt: -1 }).lean();
      const maxFee = feeProfile ? feeProfile.netFee || feeProfile.grossFee || 0 : 0;
      if (maxFee > 0 && totalPaid + amount > maxFee) {
        const maxAllowed = maxFee - totalPaid;
        throw new AppError(
          `Cannot overpay. Total fee: Rs.${maxFee}, Already paid: Rs.${totalPaid}. Max allowed: Rs.${maxAllowed}`,
          400
        );
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

    // ─── Apply payment to invoice installments ─────────────────
    // (handled inline by recordInstallmentPayment; legacy path skips)
    if (invoice && invoice.installments?.length > 0) {
      // Already handled by invoice.save() above — installments tracked per invoice
    }

    // Activity + notification (non-blocking)
    FeesService._triggerPaymentActivity(student, amount, paymentMode, payment.receiptNumber);
    FeesService._triggerPaymentNotification(student, amount, payment.receiptNumber);

    return { payment, invoice };
  }

  // _applyPaymentToInstallments now handled by recordInstallmentPayment directly on invoice.installments
  // Legacy FeeStructure installment update removed.

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
   * Returns { student, invoice, feeProfile, payments, installments, summary }
   */
  static async getStudentFees(studentId) {
    if (!mongoose.isValidObjectId(studentId)) throw new AppError('Invalid student ID format', 400);

    const student = await Student.findById(studentId)
      .populate('classId', 'name code')
      .lean();
    if (!student) throw new AppError('Student not found', 404);

    // Fetch invoice
    const invoice = await FeeInvoice.findOne({ studentId })
      .populate('feeProfileId')
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch StudentFeeProfile for fallback
    const feeProfile = invoice?.feeProfileId
      || await StudentFeeProfile.findOne({ studentId }).sort({ createdAt: -1 }).lean();

    // Fetch all approved payments
    const payments = await FeePayment.find({ studentId, status: { $ne: 'rejected' } })
      .sort({ paidAt: -1 }).lean();

    // ── Installment breakdown — from invoice.installments (canonical) ──────
    const rawInstallments = invoice?.installments || [];
    const installments = rawInstallments.map((inst) => ({
      _id:        inst._id,
      label:      inst.label,
      name:       inst.label,    // backward-compat alias
      amount:     inst.amount,
      dueDate:    inst.dueDate,
      paidAmount: inst.paidAmount || 0,
      due:        Math.max(0, inst.amount - (inst.paidAmount || 0)),
      status:     inst.status || 'pending',
      overdue:    inst.dueDate && new Date(inst.dueDate) < new Date() && inst.status !== 'paid',
    }));

    // Compute summary from invoice (preferred) or from feeProfile+payments
    let totalFee, totalPaid, totalDue, status;
    if (invoice) {
      totalFee  = invoice.totalAmount;
      totalPaid = invoice.paidAmount;
      totalDue  = invoice.dueAmount;
      status    = invoice.status === 'paid' ? 'Paid' : invoice.status === 'partial' ? 'Partial' : 'Pending';
    } else {
      totalFee  = feeProfile ? (feeProfile.netFee || feeProfile.grossFee || 0) : 0;
      totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      totalDue  = Math.max(0, totalFee - totalPaid);
      status    = totalPaid >= totalFee && totalFee > 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Pending';
    }

    return {
      student,
      invoice,
      feeProfile,
      feeStructure: null,  // backward-compat key — always null now
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
    const query = { status: { $in: ['unpaid', 'partial', 'overdue'] } };
    if (filters.status === 'unpaid') query.status = 'unpaid';
    else if (filters.status === 'partial') query.status = 'partial';
    else if (filters.status === 'overdue') query.status = 'overdue';

    if (filters.classId && mongoose.isValidObjectId(filters.classId)) {
      query.classId = filters.classId;
    }

    const PenaltyEngine = require('../../utils/penaltyEngine');

    const invoices = await FeeInvoice.find(query)
      .populate('studentId', 'name rollNo admissionNumber parentPhone')
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .sort({ dueAmount: -1 })
      .lean();

    return invoices.map((inv) => {
      const penalty = PenaltyEngine.computeInvoicePenalty(inv, null);
      return {
        invoiceId:    inv._id,
        invoiceNumber: inv.invoiceNumber,
        student:      inv.studentId,
        class:        inv.classId,
        academicYear: inv.academicYearId,
        totalAmount:  inv.totalAmount,
        paidAmount:   inv.paidAmount,
        dueAmount:    inv.dueAmount,
        storedPenalty: inv.penaltyAmount || 0,
        livePenalty:  penalty.totalPenalty,
        totalPayable: (inv.dueAmount || 0) + penalty.totalPenalty,
        daysOverdue:  penalty.daysOverdue,
        status:       inv.status,
        dueDate:      inv.dueDate,
        isOverdue:    PenaltyEngine.isOverdue(inv.dueDate, inv.status),
      };
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE OVERVIEW
  // ═══════════════════════════════════════════════════════════

  /**
   * Fee overview: invoice-based. Falls back to StudentFeeProfile if no invoice.
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

    // Load invoices
    const invoices = await FeeInvoice.find({ studentId: { $in: studentIds } }).lean();
    const invoiceMap = {};
    for (const inv of invoices) invoiceMap[inv.studentId.toString()] = inv;

    // Load profiles for fallback (no FeeStructure)
    const profiles = await StudentFeeProfile.find({ studentId: { $in: studentIds } }).lean();
    const profileMap = {};
    for (const p of profiles) profileMap[p.studentId.toString()] = p;

    // Load payments for fallback
    const payments = await FeePayment.find({ studentId: { $in: studentIds } }).lean();
    const paidMap = {};
    for (const p of payments) {
      const key = p.studentId.toString();
      paidMap[key] = (paidMap[key] || 0) + p.amount;
    }

    return students.map((student) => {
      const inv     = invoiceMap[student._id.toString()];
      const profile = profileMap[student._id.toString()];
      let totalFee, totalPaid, totalDue, status;

      if (inv) {
        totalFee  = inv.totalAmount;
        totalPaid = inv.paidAmount;
        totalDue  = inv.dueAmount;
        status    = inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : 'Pending';
      } else if (profile) {
        totalFee  = profile.netFee || profile.grossFee || 0;
        totalPaid = paidMap[student._id.toString()] || 0;
        totalDue  = Math.max(0, totalFee - totalPaid);
        status    = totalPaid >= totalFee && totalFee > 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Pending';
      } else {
        totalFee = totalPaid = totalDue = 0;
        status   = 'Pending';
      }

      return {
        _id:           student._id,
        name:          student.name,
        rollNo:        student.rollNo,
        className:     student.classId?.name || '—',
        classId:       student.classId?._id,
        invoiceId:     inv?._id || null,
        invoiceNumber: inv?.invoiceNumber || null,
        totalFee,
        totalPaid,
        totalDue,
        status,
        dueDate:     inv?.dueDate || null,
        nextDueDate: inv?.nextDueDate || null,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  APPLY FEE STRUCTURE TO CLASS (bulk invoice generation)
  // ═══════════════════════════════════════════════════════════

  /**
   * Generate invoices for ALL students in a class that have a fee profile.
   * Idempotent — skips students who already have an invoice for the academic year.
   */
  static async applyStructureToClass({ classId, academicYearId, sectionId }) {
    if (!classId) throw new AppError('classId is required', 400);

    const SetupService = require('../setup/service');
    const resolvedYearId = await SetupService.resolveAcademicYearId(academicYearId);

    const studentQuery = { classId, isActive: true };
    if (sectionId && mongoose.isValidObjectId(sectionId)) studentQuery.sectionId = sectionId;

    const students = await Student.find(studentQuery).select('_id classId').lean();
    if (!students.length) return { generated: 0, skipped: 0, total: 0 };

    let generated = 0, skipped = 0;

    for (const student of students) {
      try {
        const existing = await FeeInvoice.findOne({ studentId: student._id, academicYearId: resolvedYearId });
        if (existing) { skipped++; continue; }

        await FeesService.generateInvoice({
          studentId:      student._id,
          classId:        student.classId,
          academicYearId: resolvedYearId,
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

    // Update invoice totals + advance nextDueDate to next unpaid installment
    invoice.paidAmount  = (invoice.paidAmount || 0) + amount;
    invoice.nextDueDate = FeesService._computeNextDueDate(invoice.installments);
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
   * Enhanced getStudentFees — includes StudentFeeProfile + auto-penalty.
   * Backward compatible with old class-wise invoice system.
   */
  static async getEnhancedStudentFees(studentId) {
    if (!mongoose.isValidObjectId(studentId)) throw new AppError('Invalid student ID', 400);

    const baseData = await FeesService.getStudentFees(studentId);

    // Load the StudentFeeProfile
    const StudentFeeProfile = require('../../models/StudentFeeProfile');
    const profile = await StudentFeeProfile.findOne({ studentId })
      .populate('selectedComponents.componentId', 'name code amount mandatory recurringType lateFeeConfig')
      .populate('discounts.approvedBy', 'name')
      .populate('lockedBy', 'name')
      .lean();

    // Auto-compute live penalty (non-destructive — does NOT write to DB)
    const PenaltyEngine = require('../../utils/penaltyEngine');
    const penaltySummary = PenaltyEngine.computeInvoicePenalty(
      baseData.invoice || {},
      profile
    );

    // Enrich summary with live penalty
    const summary = { ...baseData.summary };
    if (penaltySummary.totalPenalty > 0) {
      const storedPenalty = baseData.invoice?.penaltyAmount || 0;
      const effectivePenalty = Math.max(penaltySummary.totalPenalty, storedPenalty);
      summary.livePenalty      = penaltySummary.totalPenalty;
      summary.effectivePenalty = effectivePenalty;
      summary.daysOverdue      = penaltySummary.daysOverdue;
      summary.penaltyBreakdown = penaltySummary.breakdown;
      summary.totalPayable     = (summary.totalDue || 0) + effectivePenalty;
      summary.penaltyDetails   = penaltySummary.details;
    } else {
      summary.livePenalty    = 0;
      summary.effectivePenalty = baseData.invoice?.penaltyAmount || 0;
      summary.daysOverdue    = penaltySummary.daysOverdue;
      summary.totalPayable   = (summary.totalDue || 0) + (baseData.invoice?.penaltyAmount || 0);
    }

    return { ...baseData, feeProfile: profile || null, penaltySummary, summary };
  }

  // ═══════════════════════════════════════════════════════════
  //  REGENERATE SCHEDULE
  // ═══════════════════════════════════════════════════════════

  /**
   * Regenerate the installment schedule for an invoice from its StudentFeeProfile.
   * SOURCE OF TRUTH: StudentFeeProfile.installments
   * Preserves already-paid amounts by index (primary), then label (fallback).
   * @param {string} invoiceId
   * @param {string} userId
   */
  static async regenerateSchedule(invoiceId, userId) {
    const invoice = await FeeInvoice.findById(invoiceId);
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.locked) throw new AppError('Invoice is locked. Cannot regenerate schedule.', 403);

    // Resolve StudentFeeProfile
    const profile = await StudentFeeProfile.findOne({
      studentId:      invoice.studentId,
      academicYearId: invoice.academicYearId,
    }).sort({ createdAt: -1 });

    if (!profile) {
      throw new AppError(
        'No fee profile found for this student. Assign fee components first in Fees → Assign Fees.',
        400
      );
    }

    if (!profile.installments || profile.installments.length === 0) {
      throw new AppError('Fee profile has no installment schedule defined.', 400);
    }

    // Map existing paid amounts by index and label to preserve payment history
    const existingByIndex = new Map();
    const existingByLabel = new Map();
    (invoice.installments || []).forEach((inst, i) => {
      if (inst.paidAmount > 0) {
        existingByIndex.set(i, inst.paidAmount);
        existingByLabel.set((inst.label || '').trim().toLowerCase(), inst.paidAmount);
      }
    });

    const now = new Date();
    const newInstallments = profile.installments.map((inst, i) => {
      const labelKey    = (inst.label || '').trim().toLowerCase();
      const previousPaid = existingByIndex.has(i)
        ? existingByIndex.get(i)
        : (existingByLabel.get(labelKey) || 0);

      return {
        installmentNo: inst.installmentNo || i + 1,
        label:         inst.label,
        amount:        inst.amount,
        dueDate:       inst.dueDate || null,
        paidAmount:    previousPaid,
        status:        previousPaid >= inst.amount ? 'paid'
                     : previousPaid > 0            ? 'partial'
                     : inst.dueDate && new Date(inst.dueDate) < now ? 'overdue'
                     : 'pending',
      };
    });

    // Rebuild legacy feeItems from selectedComponents
    const newFeeItems = (profile.selectedComponents || []).map(c => ({
      name:   c.name,
      amount: c.amount,
    }));

    const dueDates = newInstallments
      .filter(i => i.dueDate)
      .map(i => new Date(i.dueDate))
      .sort((a, b) => a - b);
    const dueDate    = dueDates[0] || null;
    const nextDueDate = FeesService._computeNextDueDate(newInstallments);

    invoice.installments   = newInstallments;
    invoice.feeItems       = newFeeItems;
    invoice.totalAmount    = profile.grossFee;
    invoice.discountAmount = profile.discountAmt;
    invoice.feeProfileId   = profile._id;
    invoice.dueDate        = dueDate;
    invoice.nextDueDate    = nextDueDate;

    // Recalculate invoice-level dueAmount and status
    const net = invoice.totalAmount + (invoice.penaltyAmount || 0) - (invoice.discountAmount || 0);
    invoice.dueAmount = Math.max(0, net - (invoice.paidAmount || 0));
    invoice.status = invoice.paidAmount >= net && net > 0 ? 'paid'
                   : invoice.paidAmount > 0 ? 'partial'
                   : 'unpaid';

    await invoice.save();

    ActivityService.log({
      studentId: invoice.studentId,
      action:    `Installment schedule regenerated for invoice ${invoice.invoiceNumber}`,
      module:    'fee',
      metadata:  { invoiceId, userId },
    }).catch(() => {});

    return invoice;
  }
}

module.exports = FeesService;

