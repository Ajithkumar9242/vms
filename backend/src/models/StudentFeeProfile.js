const mongoose = require('mongoose');

/**
 * StudentFeeProfile — one record per student per academic year.
 *
 * SINGLE SOURCE OF TRUTH for:
 *   - Which fee components a student pays  (selectedComponents)
 *   - The payment schedule                  (installments)
 *   - Discounts                             (discounts)
 *   - Computed totals                       (grossFee, discountAmt, netFee)
 *
 * FeeStructure is NO LONGER the schedule source.
 */

// ── Discount sub-schema ────────────────────────────────────────
const discountSchema = new mongoose.Schema(
  {
    type:         { type: String, enum: ['scholarship', 'sibling', 'staff_child', 'custom'], required: true },
    label:        { type: String, trim: true, default: '' },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    value:        { type: Number, required: true, min: 0 },
    reason:       { type: String, trim: true, default: '' },
    approvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    appliedAt:    { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Selected fee component sub-schema ─────────────────────────
const selectedComponentSchema = new mongoose.Schema(
  {
    componentId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeComponent', required: true },
    name:        { type: String, trim: true },
    code:        { type: String, trim: true },
    amount:      { type: Number, min: 0 },
    mandatory:   { type: Boolean, default: false },
  },
  { _id: false }
);

// ── Installment sub-schema (payment schedule) ─────────────────
const installmentSchema = new mongoose.Schema(
  {
    installmentNo: { type: Number, required: true },
    label:         { type: String, trim: true, required: true },
    amount:        { type: Number, required: true, min: 0 },
    dueDate:       { type: Date, default: null },
  },
  { _id: true }
);

// ── Main schema ────────────────────────────────────────────────
const studentFeeProfileSchema = new mongoose.Schema(
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

    // Fee components this student pays (what they owe)
    selectedComponents: [selectedComponentSchema],

    // Payment schedule — when and how much each installment is due
    // Rule: sum(installments.amount) === netFee  (±1 rounding tolerance)
    installments: [installmentSchema],

    // Discounts applied to this student
    discounts: [discountSchema],

    // Computed totals — auto-updated by pre-save hook
    grossFee:    { type: Number, default: 0 },   // sum of selectedComponents.amount
    discountAmt: { type: Number, default: 0 },   // total discount value
    netFee:      { type: Number, default: 0 },   // grossFee - discountAmt  (renamed from totalFee)
    totalFee:    { type: Number, default: 0 },   // ALIAS of netFee for backward-compat

    // Locking
    locked:     { type: Boolean, default: false },
    lockedAt:   { type: Date, default: null },
    lockedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    unlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    unlockedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────
studentFeeProfileSchema.index({ studentId: 1, academicYearId: 1 }, { unique: true });
studentFeeProfileSchema.index({ classId: 1, academicYearId: 1 });

// ── Pre-save: compute grossFee, discountAmt, netFee; auto-create installments ──
studentFeeProfileSchema.pre('save', function () {
  // 1. Gross fee = sum of selected components
  this.grossFee = (this.selectedComponents || []).reduce(
    (sum, c) => sum + (c.amount || 0),
    0
  );

  // 2. Discount amount
  let disc = 0;
  for (const d of this.discounts || []) {
    if (d.discountType === 'percent') {
      disc += Math.round((this.grossFee * d.value) / 100);
    } else {
      disc += d.value;
    }
  }
  this.discountAmt = disc;
  this.netFee      = Math.max(0, this.grossFee - disc);
  this.totalFee    = this.netFee;  // keep backward-compat alias in sync

  // 3. Auto-create a single "Full Payment" installment if none set
  if (!this.installments || this.installments.length === 0) {
    this.installments = [{
      installmentNo: 1,
      label:         'Full Payment',
      amount:        this.netFee,
      dueDate:       null,
    }];
    return;  // skip sum validation — single installment always matches
  }

  // 4. Validate: installments must sum to netFee (±1 rounding tolerance)
  const instSum = this.installments.reduce((s, i) => s + (i.amount || 0), 0);
  if (Math.abs(instSum - this.netFee) > 1) {
    throw new Error(
      `Installment amounts sum to Rs.${instSum} but netFee is Rs.${this.netFee}. They must match.`
    );
  }
});

module.exports = mongoose.model('StudentFeeProfile', studentFeeProfileSchema);
