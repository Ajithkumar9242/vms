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
      const { studentId, amount, paymentMode, transactionId } = req.body;
      const payment = await FeesService.recordPayment({
        studentId,
        amount,
        paymentMode,
        transactionId,
      });

      // Fetch student to get contact details for notifications
      const Student = require('../../models/Student');
      const student = await Student.findById(studentId).populate('parentId');
      
      if (student) {
        // Send Email Receipt
        const EmailService = require('../../utils/emailService');
        EmailService.sendFeeReceiptEmail(student, payment).catch(e => 
          console.error('Fee receipt email failed:', e.message)
        );

        // Fallback SMS
        const phone = student.parentPhone || (student.parentId && student.parentId.phone);
        if (phone) {
          const NotificationService = require('../notification/service');
          NotificationService.sendSMS(phone, `Received fee payment of ₹${payment.amountPaid} for ${student.name}. Receipt: ${payment.receiptNumber}`).catch(e => console.error('SMS fallback failed:', e.message));
        }
      }

      return ApiResponse.created(res, payment, 'Payment recorded successfully');
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
}

module.exports = FeesController;
