const mongoose = require('mongoose');

const attendanceConfigSchema = new mongoose.Schema(
  {
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year is required'],
    },
    // e.g. ["Morning", "Afternoon"] or ["P1","P2","P3","P4","P5","P6"]
    sessions: {
      type: [String],
      default: ['Morning'],
    },
  },
  { timestamps: true }
);

// One config per academic year
attendanceConfigSchema.index({ academicYearId: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceConfig', attendanceConfigSchema);
