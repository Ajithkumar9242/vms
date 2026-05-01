const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
