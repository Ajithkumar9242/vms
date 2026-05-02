const mongoose = require('mongoose');

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
  },
  { _id: true }
);

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

// Ensure one fee structure per class per academic year
feeStructureSchema.index({ classId: 1, academicYearId: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
