const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    feeType: {
      type: String,
      enum: ['tuition', 'transport', 'lab', 'library', 'exam', 'other'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paidDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue'],
      default: 'pending',
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Fee', feeSchema);
