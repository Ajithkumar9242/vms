const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema(
  {
    applicationNo: {
      type: String,
      unique: true,
      required: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required'],
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
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      default: null,
    },

    // ─── Admission Mode & Type ──────────────────────────────
    mode: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline',
    },
    type: {
      type: String,
      enum: ['residential', 'day-boarding'],
      default: 'day-boarding',
    },

    // ─── Parent / Guardian Info ─────────────────────────────
    parentName: {
      type: String,
      required: [true, 'Parent/Guardian name is required'],
      trim: true,
    },
    fatherName: {
      type: String,
      trim: true,
    },
    motherName: {
      type: String,
      trim: true,
    },
    parentPhone: {
      type: String,
      required: [true, 'Parent phone is required'],
      trim: true,
    },
    parentEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },

    // ─── Academic Info ──────────────────────────────────────
    previousSchool: {
      type: String,
      trim: true,
    },
    previousBoard: {
      type: String,
      trim: true,
    },
    hasTC: {
      type: Boolean,
      default: false,
    },

    // ─── Medical Info ───────────────────────────────────────
    bloodGroup: {
      type: String,
      trim: true,
    },
    allergies: {
      type: String,
      trim: true,
    },
    medicalConditions: {
      type: String,
      trim: true,
    },

    // ─── Payment (Razorpay) ─────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'na'],
      default: 'na',
    },
    paymentId: {
      type: String,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },

    // ─── Status & Workflow ──────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    remarks: {
      type: String,
      trim: true,
    },
    documents: [
      {
        name: { type: String, trim: true },
        url: { type: String },
        publicId: { type: String },
      },
    ],
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
  },
  { timestamps: true }
);

// Index for fast lookups
admissionSchema.index({ parentPhone: 1 });
admissionSchema.index({ razorpayOrderId: 1 });

module.exports = mongoose.model('Admission', admissionSchema);
