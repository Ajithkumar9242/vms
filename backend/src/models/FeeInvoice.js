const mongoose = require('mongoose');

/**
 * FeeInvoice — one invoice per student per academic year.
 * Enhanced: supports student-wise fee profiles, penalties, discounts, installments, locking.
 * Backward compatible — all new fields are optional with safe defaults.
 */

const installmentDetailSchema = new mongoose.Schema(
  {
    installmentNo: { type: Number },
    label:         { type: String, trim: true },
    amount:        { type: Number, min: 0 },
    dueDate:       { type: Date, default: null },
    paidAmount:    { type: Number, default: 0 },
    paidAt:        { type: Date, default: null },
    paymentMode:   { type: String, enum: ['cash', 'upi', 'online', 'razorpay', 'cheque', 'bank_transfer'], default: null },
    collectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receiptNumber: { type: String, default: null },
    status:        { type: String, enum: ['pending', 'paid', 'partial', 'overdue'], default: 'pending' },
    transactionId: { type: String, default: null },
  },
  { _id: true }
);

const feeInvoiceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      default: null,
    },

    // ─── Legacy fee structure link ────────────────────────
    feeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeStructure',
      default: null,
    },

    // ─── NEW: Student fee profile link ───────────────────
    feeProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentFeeProfile',
      default: null,
    },

    // ─── Legacy fee items (installments from FeeStructure) ───
    feeItems: [
      {
        name:    { type: String, trim: true },
        amount:  { type: Number, min: 0 },
        dueDate: { type: Date },
      },
    ],

    // ─── NEW: Student-wise installment details ───────────
    installments: [installmentDetailSchema],

    // ─── Amounts ─────────────────────────────────────────
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: [0, 'Due amount cannot be negative'],
    },

    // ─── NEW: Penalty & Discount ─────────────────────────
    penaltyAmount: { type: Number, default: 0, min: 0 },
    discountAmount:{ type: Number, default: 0, min: 0 },
    waivedAmount:  { type: Number, default: 0, min: 0 },
    waivedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    waivedReason:  { type: String, trim: true, default: '' },
    waivedAt:      { type: Date, default: null },

    // ─── Status ──────────────────────────────────────────
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'overdue'],
      default: 'unpaid',
    },

    // ─── Dates ───────────────────────────────────────────
    dueDate: { type: Date, default: null },

    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    // ─── NEW: Locking system ─────────────────────────────
    locked:     { type: Boolean, default: false },
    lockedAt:   { type: Date, default: null },
    lockedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    unlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    unlockedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// One invoice per student per academic year
feeInvoiceSchema.index({ studentId: 1, academicYearId: 1 }, { unique: true });
feeInvoiceSchema.index({ status: 1 });
feeInvoiceSchema.index({ classId: 1 });
feeInvoiceSchema.index({ feeProfileId: 1 });

// Auto-generate invoiceNumber before save
feeInvoiceSchema.pre('save', async function () {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('FeeInvoice').countDocuments();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  // Keep dueAmount in sync — net due = total + penalty - discount - paid
  const net = this.totalAmount + (this.penaltyAmount || 0) - (this.discountAmount || 0);
  this.dueAmount = Math.max(0, net - (this.paidAmount || 0));

  // Auto-update status
  if (this.paidAmount >= net && net > 0) {
    this.status = 'paid';
  } else if ((this.paidAmount || 0) > 0) {
    this.status = 'partial';
  } else if (this.dueDate && new Date(this.dueDate) < new Date() && this.status !== 'paid') {
    this.status = 'overdue';
  }
});

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);
