const mongoose = require('mongoose');

/**
 * FeeComponent — master list of fee types (Tuition, Hostel, Bus, Meals, etc.)
 * Mandatory components auto-apply to ALL students.
 * Optional components can be selectively assigned.
 */
const lateFeeConfigSchema = new mongoose.Schema(
  {
    enabled:   { type: Boolean, default: false },
    type:      { type: String, enum: ['percent', 'fixed'], default: 'fixed' },
    value:     { type: Number, default: 0, min: 0 },
    frequency: { type: String, enum: ['daily', 'monthly'], default: 'monthly' },
  },
  { _id: false }
);

const feeComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Component name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Component code is required'],
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    mandatory: {
      type: Boolean,
      default: false,
    },
    recurringType: {
      type: String,
      enum: ['yearly', 'monthly', 'quarterly', 'one_time'],
      default: 'yearly',
    },
    allowInstallments: {
      type: Boolean,
      default: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lateFeeConfig: {
      type: lateFeeConfigSchema,
      default: () => ({ enabled: false, type: 'fixed', value: 0, frequency: 'monthly' }),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Unique code constraint
feeComponentSchema.index({ code: 1 }, { unique: true });
feeComponentSchema.index({ mandatory: 1, active: 1 });

module.exports = mongoose.model('FeeComponent', feeComponentSchema);
