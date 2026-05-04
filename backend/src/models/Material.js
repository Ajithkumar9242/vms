const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    title:      { type: String, required: true, trim: true, maxlength: 200 },
    description:{ type: String, trim: true, default: '' },
    type: {
      type: String,
      enum: ['pdf', 'video', 'audio', 'image', 'link', 'other'],
      required: true,
    },
    fileUrl:    { type: String, default: null },   // Cloudinary/local URL or external link
    fileName:   { type: String, default: null },
    mimeType:   { type: String, default: null },
    size:       { type: Number, default: 0 },
    classId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: true, index: true },
    subjectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

materialSchema.index({ classId: 1, subjectId: 1, isActive: 1 });

module.exports = mongoose.model('Material', materialSchema);
