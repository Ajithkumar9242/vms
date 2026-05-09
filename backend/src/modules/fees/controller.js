const FeesService        = require('./service');
const FeeComponentService = require('./componentService');
const ProfileService      = require('./profileService');
const AnalyticsService   = require('./analyticsService');
const ApiResponse        = require('../../utils/apiResponse');

/**
 * Fees Controller — handles HTTP request/response.
 * Delegates all business logic to respective services.
 */
class FeesController {
  /**
   * GET /api/fees/health
   */
  static async health(req, res, next) {
    try {
      const data = await FeesService.getModuleStatus();
      return ApiResponse.success(res, data, 'Fees module operational');
    } catch (error) { next(error); }
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE STRUCTURE (legacy — unchanged)
  // ═══════════════════════════════════════════════════════════

  static async createStructure(req, res, next) {
    try {
      const { classId, academicYear, academicYearId, totalAmount, installments, feeGroupId, installmentCount, startDate, frequency } = req.body;
      const structure = await FeesService.createStructure({ classId, academicYear, academicYearId, totalAmount, installments, feeGroupId, installmentCount, startDate, frequency });
      return ApiResponse.created(res, structure, 'Fee structure saved successfully');
    } catch (error) { next(error); }
  }

  static async getStructures(req, res, next) {
    try {
      const { classId, academicYear, academicYearId } = req.query;
      const structures = await FeesService.getStructures({ classId, academicYear, academicYearId });
      return ApiResponse.success(res, structures, 'Fee structures fetched');
    } catch (error) { next(error); }
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE COMPONENTS
  // ═══════════════════════════════════════════════════════════

  static async getComponents(req, res, next) {
    try {
      const components = await FeeComponentService.getAll(req.query);
      return ApiResponse.success(res, components, 'Fee components fetched');
    } catch (error) { next(error); }
  }

  static async getComponent(req, res, next) {
    try {
      const component = await FeeComponentService.getById(req.params.id);
      return ApiResponse.success(res, component, 'Fee component fetched');
    } catch (error) { next(error); }
  }

  static async createComponent(req, res, next) {
    try {
      const component = await FeeComponentService.create(req.body, req.user._id);
      return ApiResponse.created(res, component, 'Fee component created');
    } catch (error) { next(error); }
  }

  static async updateComponent(req, res, next) {
    try {
      const component = await FeeComponentService.update(req.params.id, req.body, req.user._id);
      return ApiResponse.success(res, component, 'Fee component updated');
    } catch (error) { next(error); }
  }

  static async toggleComponent(req, res, next) {
    try {
      const component = await FeeComponentService.toggleActive(req.params.id);
      return ApiResponse.success(res, component, 'Fee component toggled');
    } catch (error) { next(error); }
  }

  static async deleteComponent(req, res, next) {
    try {
      const component = await FeeComponentService.remove(req.params.id);
      return ApiResponse.success(res, component, 'Fee component deactivated');
    } catch (error) { next(error); }
  }

  // ═══════════════════════════════════════════════════════════
  //  STUDENT FEE PROFILES
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/fees/profiles/class/:classId
   * Returns the full spreadsheet matrix for a class.
   */
  static async getClassMatrix(req, res, next) {
    try {
      const { classId } = req.params;
      const { academicYearId } = req.query;
      const data = await ProfileService.getClassMatrix(classId, academicYearId);
      return ApiResponse.success(res, data, 'Class fee matrix fetched');
    } catch (error) { next(error); }
  }

  /**
   * POST /api/fees/profiles/bulk-save
   * Bulk-save fee assignments for all students in a class.
   */
  static async bulkSaveProfiles(req, res, next) {
    try {
      const { classId, academicYearId, rows } = req.body;
      const result = await ProfileService.bulkSave({ classId, academicYearId, rows, userId: req.user._id });
      return ApiResponse.success(res, result, `Profiles saved: ${result.saved}, skipped (locked): ${result.skipped}`);
    } catch (error) { next(error); }
  }

  /**
   * GET /api/fees/profiles/student/:studentId
   */
  static async getStudentProfile(req, res, next) {
    try {
      const { studentId } = req.params;
      const { academicYearId } = req.query;
      const profile = await ProfileService.getStudentProfile(studentId, academicYearId);
      return ApiResponse.success(res, profile, 'Student fee profile fetched');
    } catch (error) { next(error); }
  }

  /**
   * POST /api/fees/profiles/student/:studentId/discount
   */
  static async addDiscount(req, res, next) {
    try {
      const { studentId } = req.params;
      const { academicYearId } = req.query;
      const profile = await ProfileService.addDiscount(studentId, academicYearId, req.body, req.user._id);
      return ApiResponse.success(res, profile, 'Discount added');
    } catch (error) { next(error); }
  }

  /**
   * POST /api/fees/profiles/student/:studentId/lock
   */
  static async lockProfile(req, res, next) {
    try {
      const { studentId } = req.params;
      const { academicYearId } = req.body;
      const profile = await ProfileService.lockProfile(studentId, academicYearId, req.user._id);
      return ApiResponse.success(res, profile, 'Profile locked');
    } catch (error) { next(error); }
  }

  /**
   * POST /api/fees/profiles/student/:studentId/unlock
   */
  static async unlockProfile(req, res, next) {
    try {
      const { studentId } = req.params;
      const { academicYearId } = req.body;
      const profile = await ProfileService.unlockProfile(studentId, academicYearId, req.user._id);
      return ApiResponse.success(res, profile, 'Profile unlocked');
    } catch (error) { next(error); }
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE PAYMENTS (legacy — unchanged + enhanced)
  // ═══════════════════════════════════════════════════════════

  static async recordPayment(req, res, next) {
    try {
      const { studentId, amount, paymentMode, transactionId, invoiceId } = req.body;
      const result = await FeesService.recordPayment({ studentId, amount, paymentMode, transactionId, invoiceId });

      try {
        const Student = require('../../models/Student');
        const student = await Student.findById(studentId).populate('parentId');
        if (student) {
          const EmailService = require('../../utils/emailService');
          EmailService.sendFeeReceiptEmail(student, result.payment).catch(() => {});
          const phone = student.parentPhone || student.parentId?.phone;
          if (phone) {
            const NotificationService = require('../notification/service');
            NotificationService.sendSMS(phone, `Received fee payment of ₹${amount} for ${student.name}. Receipt: ${result.payment.receiptNumber}`).catch(() => {});
          }
        }
      } catch { /* non-critical */ }

      return ApiResponse.created(res, result, 'Payment recorded successfully');
    } catch (error) { next(error); }
  }

  /**
   * POST /api/fees/invoice/:invoiceId/pay
   * Record payment against a specific installment.
   */
  static async recordInstallmentPayment(req, res, next) {
    try {
      const { invoiceId } = req.params;
      const { installmentId, amount, paymentMode, transactionId } = req.body;
      const result = await FeesService.recordInstallmentPayment({
        invoiceId, installmentId, amount, paymentMode, transactionId, userId: req.user._id,
      });
      return ApiResponse.created(res, result, 'Installment payment recorded');
    } catch (error) { next(error); }
  }

  static async getInvoice(req, res, next) {
    try {
      const { studentId } = req.params;
      const { academicYearId } = req.query;
      const invoice = await FeesService.getInvoice(studentId, academicYearId);
      return ApiResponse.success(res, invoice, 'Invoice fetched');
    } catch (error) { next(error); }
  }

  static async getInvoiceById(req, res, next) {
    try {
      const FeeInvoice = require('../../models/FeeInvoice');
      const invoice = await FeeInvoice.findById(req.params.invoiceId)
        .populate('studentId', 'name rollNo parentName parentPhone classId')
        .populate('classId', 'name code')
        .populate('academicYearId', 'name')
        .populate('feeProfileId')
        .populate('lockedBy', 'name')
        .populate('waivedBy', 'name');
      if (!invoice) { const AppError = require('../../utils/AppError'); throw new AppError('Invoice not found', 404); }
      return ApiResponse.success(res, invoice, 'Invoice fetched');
    } catch (error) { next(error); }
  }

  static async generateInvoice(req, res, next) {
    try {
      const { studentId } = req.body;
      const Student = require('../../models/Student');
      const student = await Student.findById(studentId);
      if (!student) { const AppError = require('../../utils/AppError'); throw new AppError('Student not found', 404); }
      const invoice = await FeesService.generateInvoice({ studentId: student._id, classId: student.classId, academicYearId: student.academicYearId, feeStructureId: student.feeStructureId });
      return ApiResponse.created(res, invoice, 'Invoice generated');
    } catch (error) { next(error); }
  }

  // ─── Penalty Engine ────────────────────────────────────────
  static async applyPenalty(req, res, next) {
    try {
      const { invoiceId } = req.params;
      const { type, value } = req.body;
      const invoice = await FeesService.applyPenalty(invoiceId, { type, value }, req.user._id);
      return ApiResponse.success(res, invoice, 'Penalty applied');
    } catch (error) { next(error); }
  }

  static async waivePenalty(req, res, next) {
    try {
      const { invoiceId } = req.params;
      const { waiveAmount, reason } = req.body;
      const invoice = await FeesService.waivePenalty(invoiceId, { waiveAmount, reason }, req.user._id);
      return ApiResponse.success(res, invoice, 'Penalty waived');
    } catch (error) { next(error); }
  }

  // ─── Invoice Locking ──────────────────────────────────────
  static async lockInvoice(req, res, next) {
    try {
      const invoice = await FeesService.lockInvoice(req.params.invoiceId, req.user._id);
      return ApiResponse.success(res, invoice, 'Invoice locked');
    } catch (error) { next(error); }
  }

  static async unlockInvoice(req, res, next) {
    try {
      const invoice = await FeesService.unlockInvoice(req.params.invoiceId, req.user._id);
      return ApiResponse.success(res, invoice, 'Invoice unlocked');
    } catch (error) { next(error); }
  }

  // ─── Due List ─────────────────────────────────────────────
  static async getDueList(req, res, next) {
    try {
      const { classId, status } = req.query;
      const data = await FeesService.getDueList({ classId, status });
      return ApiResponse.success(res, data, 'Due list fetched');
    } catch (error) { next(error); }
  }

  // ─── Student Fees (enhanced) ──────────────────────────────
  static async getStudentFees(req, res, next) {
    try {
      const { studentId } = req.params;
      const data = await FeesService.getEnhancedStudentFees(studentId);
      return ApiResponse.success(res, data, 'Student fee details fetched');
    } catch (error) { next(error); }
  }

  // ─── Overview ─────────────────────────────────────────────
  static async getOverview(req, res, next) {
    try {
      const { classId } = req.query;
      const data = await FeesService.getFeeOverview({ classId });
      return ApiResponse.success(res, data, 'Fee overview fetched');
    } catch (error) { next(error); }
  }

  // ─── Analytics (new) ──────────────────────────────────────
  static async getDashboardStats(req, res, next) {
    try {
      const { classId, academicYearId } = req.query;
      const data = await AnalyticsService.getDashboardStats({ classId, academicYearId });
      return ApiResponse.success(res, data, 'Dashboard stats fetched');
    } catch (error) { next(error); }
  }

  static async getMonthlyCollection(req, res, next) {
    try {
      const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
      const data = await AnalyticsService.getMonthlyCollection(year);
      return ApiResponse.success(res, data, 'Monthly collection data fetched');
    } catch (error) { next(error); }
  }

  static async getClasswiseDues(req, res, next) {
    try {
      const { academicYearId } = req.query;
      const data = await AnalyticsService.getClasswiseDues(academicYearId);
      return ApiResponse.success(res, data, 'Classwise dues fetched');
    } catch (error) { next(error); }
  }

  static async getComponentSummary(req, res, next) {
    try {
      const { academicYearId } = req.query;
      const data = await AnalyticsService.getComponentSummary(academicYearId);
      return ApiResponse.success(res, data, 'Component summary fetched');
    } catch (error) { next(error); }
  }

  // ─── Apply fee structure to class (legacy bulk) ───────────
  static async applyStructure(req, res, next) {
    try {
      const { classId, academicYearId, sectionId } = req.body;
      const result = await FeesService.applyStructureToClass({ classId, academicYearId, sectionId });
      return ApiResponse.success(res, result, `Fee structure applied: ${result.generated} invoices generated, ${result.skipped} skipped`);
    } catch (error) { next(error); }
  }

  // ─── Manual payment flow ──────────────────────────────────
  static async manualPayment(req, res, next) {
    try {
      const { studentId, amount, paymentMode, transactionId, proofUrl, invoiceId } = req.body;
      const payment = await FeesService.recordManualPayment({ studentId, amount, paymentMode, transactionId, proofUrl, invoiceId });
      return ApiResponse.created(res, payment, 'Manual payment submitted. Awaiting admin approval.');
    } catch (error) { next(error); }
  }

  static async approvePayment(req, res, next) {
    try {
      const payment = await FeesService.approvePayment(req.params.id, req.user._id);
      return ApiResponse.success(res, payment, 'Payment approved and invoice updated');
    } catch (error) { next(error); }
  }

  static async rejectPayment(req, res, next) {
    try {
      const { reason } = req.body;
      const payment = await FeesService.rejectPayment(req.params.id, reason);
      return ApiResponse.success(res, payment, 'Payment rejected');
    } catch (error) { next(error); }
  }

  static async getPendingPayments(req, res, next) {
    try {
      const { classId } = req.query;
      const data = await FeesService.getPendingPayments({ classId });
      return ApiResponse.success(res, data, 'Pending payments fetched');
    } catch (error) { next(error); }
  }

  // ─── PDF Generation ───────────────────────────────────────
  static async generateInvoicePDF(req, res, next) {
    try {
      const { invoiceId } = req.params;
      const PdfService = require('../../utils/pdfService');
      const FeeInvoice = require('../../models/FeeInvoice');
      const SchoolSetting = require('../../models/SchoolSetting');

      const invoice = await FeeInvoice.findById(invoiceId)
        .populate('studentId', 'name rollNo parentName classId')
        .populate('classId', 'name')
        .populate('academicYearId', 'name')
        .populate('feeProfileId');

      if (!invoice) { const AppError = require('../../utils/AppError'); throw new AppError('Invoice not found', 404); }

      const school = await SchoolSetting.findOne().lean() || {};

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Invoice_${invoice.invoiceNumber}.pdf`);

      const doc = PdfService.generateInvoicePDF(invoice, school);
      doc.pipe(res);
      doc.end();
    } catch (error) { next(error); }
  }

  static async generateReceipt(req, res, next) {
    try {
      const paymentId = req.params.id;
      const PdfService = require('../../utils/pdfService');
      const FeePayment = require('../../models/FeePayment');
      const FeeInvoice = require('../../models/FeeInvoice');
      const SchoolSetting = require('../../models/SchoolSetting');

      const payment = await FeePayment.findById(paymentId).populate('studentId', 'name rollNo classId').populate('collectedBy', 'name');
      if (!payment) { const AppError = require('../../utils/AppError'); throw new AppError('Payment not found', 404); }

      const invoice = payment.invoiceId ? await FeeInvoice.findById(payment.invoiceId).populate('classId', 'name') : null;
      const school  = await SchoolSetting.findOne().lean() || {};

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Receipt_${payment.receiptNumber}.pdf`);

      const doc = PdfService.generateReceiptPDF(payment, invoice, school);
      doc.pipe(res);
      doc.end();
    } catch (error) { next(error); }
  }
}

module.exports = FeesController;
