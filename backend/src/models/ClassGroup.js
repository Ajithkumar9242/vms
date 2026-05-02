const mongoose = require('mongoose');

// ClassGroup = a specific class + section combo (e.g., "5A", "V-A")
const classGroupSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: [true, 'Section is required'],
    },
    name: { type: String, required: [true, 'Group name is required'], trim: true },
    classTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null,
    },
  },
  { timestamps: true }
);

// One group per class+section
classGroupSchema.index({ classId: 1, sectionId: 1 }, { unique: true });

module.exports = mongoose.model('ClassGroup', classGroupSchema);
