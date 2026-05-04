const mongoose = require('mongoose');

// ─── Installment sub-schema ────────────────────────────────────
const installmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Installment name is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Installment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Installment due date is required'],
    },
    // ── Payment tracking fields (new) ────────────────────────
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue'],
      default: 'pending',
    },
  },
  { _id: true }
);

// ─── FeeStructure main schema ──────────────────────────────────
const feeStructureSchema = new mongoose.Schema(
  {
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
    feeGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeGroup',
      default: null,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    installments: {
      type: [installmentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// ─── Validate: sum of installments must equal totalAmount ──────
feeStructureSchema.pre('validate', async function () {
  if (!this.installments || this.installments.length === 0) return;
  const sum = this.installments.reduce((acc, inst) => acc + inst.amount, 0);
  // Allow ±1 rounding tolerance
  if (Math.abs(sum - this.totalAmount) > 1) {
    throw new Error(
      `Installment amounts sum to ₹${sum} but totalAmount is ₹${this.totalAmount}. They must match.`
    );
  }
});

// ─── Unique: one structure per class per year ──────────────────
feeStructureSchema.index({ classId: 1, academicYearId: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
