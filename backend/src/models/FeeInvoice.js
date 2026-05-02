const mongoose = require('mongoose');

/**
 * FeeInvoice — one invoice per student per academic year.
 * Tracks total, paid, due amounts and payment status.
 * Created automatically when a student is registered.
 */
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
    feeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeStructure',
      default: null,
    },
    // Breakdown mirroring FeeStructure installments (optional)
    feeItems: [
      {
        name: { type: String, trim: true },
        amount: { type: Number, min: 0 },
        dueDate: { type: Date },
      },
    ],
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
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    // Overall due date — first installment due or manually set
    dueDate: {
      type: Date,
      default: null,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

// One invoice per student per academic year
feeInvoiceSchema.index({ studentId: 1, academicYearId: 1 }, { unique: true });
feeInvoiceSchema.index({ status: 1 });
feeInvoiceSchema.index({ classId: 1 });

// Auto-generate invoiceNumber before save
feeInvoiceSchema.pre('save', async function () {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('FeeInvoice').countDocuments();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  // Keep dueAmount in sync
  this.dueAmount = Math.max(0, this.totalAmount - this.paidAmount);
});

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);
