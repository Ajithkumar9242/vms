const mongoose = require('mongoose');

const feePaymentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Payment amount must be at least 1'],
    },
    paymentMode: {
      type: String,
      enum: {
        values: ['cash', 'upi', 'online', 'razorpay'],
        message: 'Payment mode must be cash, upi, online, or razorpay',
      },
      required: [true, 'Payment mode is required'],
    },
    transactionId: {
      type: String,
      trim: true,
      default: null,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

// Index for fast look-ups by student
feePaymentSchema.index({ studentId: 1, paidAt: -1 });

// Auto-generate receiptNumber before save
feePaymentSchema.pre('save', async function () {
  if (!this.receiptNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('FeePayment').countDocuments();
    this.receiptNumber = `RCP-${year}-${String(count + 1).padStart(5, '0')}`;
  }
});

module.exports = mongoose.model('FeePayment', feePaymentSchema);
