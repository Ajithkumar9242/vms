const mongoose = require('mongoose');

const feeGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Fee group name is required'], unique: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeeGroup', feeGroupSchema);
