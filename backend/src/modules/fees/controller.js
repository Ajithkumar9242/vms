const FeesService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Fees Controller — handles HTTP request/response.
 * Delegates all business logic to FeesService.
 */
class FeesController {
  /**
   * GET /api/fees/health
   * Module health check.
   */
  static async health(req, res, next) {
    try {
      const data = await FeesService.getModuleStatus();
      return ApiResponse.success(res, data, 'Fees module operational');
    } catch (error) {
      next(error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE STRUCTURE
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/fees/structure
   * Create or update a fee structure for a class + academic year.
   */
  static async createStructure(req, res, next) {
    try {
      const { classId, academicYear, totalAmount, installments } = req.body;
      const structure = await FeesService.createStructure({
        classId,
        academicYear,
        totalAmount,
        installments,
      });
      return ApiResponse.created(res, structure, 'Fee structure saved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fees/structure
   * Get all fee structures (optional ?classId=xxx&academicYear=xxx).
   */
  static async getStructures(req, res, next) {
    try {
      const { classId, academicYear } = req.query;
      const structures = await FeesService.getStructures({ classId, academicYear });
      return ApiResponse.success(res, structures, 'Fee structures fetched');
    } catch (error) {
      next(error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE PAYMENTS
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/fees/pay
   * Record a fee payment for a student.
   */
  static async recordPayment(req, res, next) {
    try {
      const { studentId, amount, paymentMode, transactionId, invoiceId } = req.body;
      const result = await FeesService.recordPayment({
        studentId, amount, paymentMode, transactionId, invoiceId,
      });

      // Non-blocking: email receipt
      try {
        const Student = require('../../models/Student');
        const student = await Student.findById(studentId).populate('parentId');
        if (student) {
          const EmailService = require('../../utils/emailService');
          EmailService.sendFeeReceiptEmail(student, result.payment).catch(() => {});
          const phone = student.parentPhone || student.parentId?.phone;
          if (phone) {
            const NotificationService = require('../notification/service');
            NotificationService.sendSMS(
              phone,
              `Received fee payment of ₹${amount} for ${student.name}. Receipt: ${result.payment.receiptNumber}`
            ).catch(() => {});
          }
        }
      } catch { /* non-critical */ }

      return ApiResponse.created(res, result, 'Payment recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fees/invoice/:studentId
   * Get fee invoice for a student.
   */
  static async getInvoice(req, res, next) {
    try {
      const { studentId } = req.params;
      const { academicYearId } = req.query;
      const invoice = await FeesService.getInvoice(studentId, academicYearId);
      return ApiResponse.success(res, invoice, 'Invoice fetched');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/fees/invoice/generate
   * Manually generate invoice for a student (admin tool).
   */
  static async generateInvoice(req, res, next) {
    try {
      const { studentId } = req.body;
      const Student = require('../../models/Student');
      const student = await Student.findById(studentId);
      if (!student) { const AppError = require('../../utils/AppError'); throw new AppError('Student not found', 404); }
      const invoice = await FeesService.generateInvoice({
        studentId: student._id,
        classId: student.classId,
        academicYearId: student.academicYearId,
        feeStructureId: student.feeStructureId,
      });
      return ApiResponse.created(res, invoice, 'Invoice generated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fees/due
   * Get students with unpaid or partial fees.
   */
  static async getDueList(req, res, next) {
    try {
      const { classId, status } = req.query;
      const data = await FeesService.getDueList({ classId, status });
      return ApiResponse.success(res, data, 'Due list fetched');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fees/student/:studentId
   * Get fee details and payment history for a student.
   */
  static async getStudentFees(req, res, next) {
    try {
      const { studentId } = req.params;
      const data = await FeesService.getStudentFees(studentId);
      return ApiResponse.success(res, data, 'Student fee details fetched');
    } catch (error) {
      next(error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  FEE OVERVIEW
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/fees/overview
   * Get fee overview for all students (optional ?classId=xxx).
   */
  static async getOverview(req, res, next) {
    try {
      const { classId } = req.query;
      const data = await FeesService.getFeeOverview({ classId });
      return ApiResponse.success(res, data, 'Fee overview fetched');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/fees/:id/receipt
   * Generate downloadable PDF receipt for a fee payment.
   */
  static async generateReceipt(req, res, next) {
    try {
      const paymentId = req.params.id;
      const FeePayment = require('../../models/FeePayment');
      const Student = require('../../models/Student');
      const PDFDocument = require('pdfkit');

      const payment = await FeePayment.findById(paymentId);
      if (!payment) {
        throw new AppError('Payment record not found', 404);
      }

      const student = await Student.findById(payment.studentId).populate('classId');
      if (!student) {
        throw new AppError('Student record not found', 404);
      }

      // Initialize PDF document
      const doc = new PDFDocument({ margin: 50 });

      // Setup response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Receipt_${payment.receiptNumber}.pdf`
      );

      // Pipe PDF to response stream
      doc.pipe(res);

      // --- PDF CONTENT ---

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('VMS SCHOOL ERP', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('123 Education Lane, Learning City, 10001', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(16).font('Helvetica-Bold').text('FEE PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Payment Details
      doc.fontSize(12).font('Helvetica-Bold').text('Receipt Details');
      doc.font('Helvetica').fontSize(11);
      doc.text(`Receipt Number: ${payment.receiptNumber}`);
      doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`);
      doc.text(`Payment Mode: ${payment.paymentMode.toUpperCase()}`);
      if (payment.transactionId) {
        doc.text(`Transaction ID: ${payment.transactionId}`);
      }
      doc.moveDown();

      // Student Details
      doc.fontSize(12).font('Helvetica-Bold').text('Student Details');
      doc.font('Helvetica').fontSize(11);
      doc.text(`Student Name: ${student.name}`);
      doc.text(`Roll Number: ${student.rollNo}`);
      doc.text(`Class: ${student.classId?.name || 'N/A'}`);
      doc.moveDown();

      // Amount Details
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(`Amount Paid: Rs. ${payment.amountPaid.toFixed(2)}`);
      
      doc.moveDown(2);
      doc.font('Helvetica-Oblique').fontSize(10).text('This is a computer generated receipt and does not require a physical signature.', { align: 'center' });

      // Finalize PDF file
      doc.end();

    } catch (error) {
      next(error);
    }
  }

  // ─── Apply fee structure to class (bulk invoice) ──────────
  static async applyStructure(req, res, next) {
    try {
      const { classId, academicYearId, sectionId } = req.body;
      const result = await FeesService.applyStructureToClass({ classId, academicYearId, sectionId });
      return ApiResponse.success(res, result, `Fee structure applied: ${result.generated} invoices generated, ${result.skipped} skipped`);
    } catch (error) { next(error); }
  }

  // ─── Manual payment flow ───────────────────────────────────
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
}

module.exports = FeesController;

