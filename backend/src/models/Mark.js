const mongoose = require('mongoose');

const markSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam is required'],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    marksObtained: {
      type: Number,
      required: [true, 'Marks obtained is required'],
      min: [0, 'Marks cannot be negative'],
    },
    maxMarks: {
      type: Number,
      required: [true, 'Maximum marks is required'],
      min: [1, 'Max marks must be at least 1'],
    },
    grade: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// One mark entry per exam + student + subject
markSchema.index({ examId: 1, studentId: 1, subjectId: 1 }, { unique: true });

module.exports = mongoose.model('Mark', markSchema);
