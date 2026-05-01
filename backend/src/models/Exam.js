const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Exam name is required'],
      trim: true,
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
    subjects: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject',
          required: true,
        },
        maxMarks: {
          type: Number,
          required: [true, 'Maximum marks is required for subject'],
          min: [1, 'Max marks must be at least 1'],
        },
        passingMarks: {
          type: Number,
          default: 0,
          min: [0, 'Passing marks cannot be negative'],
        },
      },
    ],
    maxMarks: {
      type: Number,
      min: [1, 'Max marks must be at least 1'],
    },
    passingMarks: {
      type: Number,
      default: 0,
      min: [0, 'Passing marks cannot be negative'],
    },
    examDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One exam name per class per academic year
examSchema.index({ name: 1, classId: 1, academicYearId: 1 }, { unique: true });

module.exports = mongoose.model('Exam', examSchema);
