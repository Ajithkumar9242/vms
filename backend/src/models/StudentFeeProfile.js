const mongoose = require('mongoose');

/**
 * StudentFeeProfile — one record per student per academic year.
 * Stores which fee components a student pays + discounts + computed totals.
 * Created/updated by admin via the spreadsheet assignment UI.
 */

const discountSchema = new mongoose.Schema(
  {
    type:       { type: String, enum: ['scholarship', 'sibling', 'staff_child', 'custom'], required: true },
    label:      { type: String, trim: true, default: '' },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    value:      { type: Number, required: true, min: 0 },
    reason:     { type: String, trim: true, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    appliedAt:  { type: Date, default: Date.now },
  },
  { _id: true }
);

const selectedComponentSchema = new mongoose.Schema(
  {
    componentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'FeeComponent', required: true },
    name:         { type: String, trim: true },
    code:         { type: String, trim: true },
    amount:       { type: Number, min: 0 },
    mandatory:    { type: Boolean, default: false },
  },
  { _id: false }
);

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

    // Components this student pays
    selectedComponents: [selectedComponentSchema],

    // Discounts applied to this student
    discounts: [discountSchema],

    // Computed amounts (recalculated on save)
    grossFee:    { type: Number, default: 0 },   // sum of component amounts
    discountAmt: { type: Number, default: 0 },   // total discount value
    totalFee:    { type: Number, default: 0 },   // grossFee - discountAmt

    // Locking
    locked:    { type: Boolean, default: false },
    lockedAt:  { type: Date, default: null },
    lockedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    unlockedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    unlockedAt:{ type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// One profile per student per academic year
studentFeeProfileSchema.index({ studentId: 1, academicYearId: 1 }, { unique: true });
studentFeeProfileSchema.index({ classId: 1, academicYearId: 1 });

// Auto-compute grossFee and totalFee before save
studentFeeProfileSchema.pre('save', function () {
  this.grossFee = (this.selectedComponents || []).reduce(
    (sum, c) => sum + (c.amount || 0),
    0
  );
  // Compute discount amount
  let disc = 0;
  for (const d of this.discounts || []) {
    if (d.discountType === 'percent') {
      disc += Math.round((this.grossFee * d.value) / 100);
    } else {
      disc += d.value;
    }
  }
  this.discountAmt = disc;
  this.totalFee    = Math.max(0, this.grossFee - disc);
});

module.exports = mongoose.model('StudentFeeProfile', studentFeeProfileSchema);
