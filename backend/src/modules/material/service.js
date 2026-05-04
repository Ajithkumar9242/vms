const Material  = require('../../models/Material');
const AppError  = require('../../utils/AppError');
const mongoose  = require('mongoose');
const ActivityService = require('../activity/service');

class MaterialService {
  static async create(data, user) {
    const { title, description, type, fileUrl, fileName, mimeType, size, classId, subjectId } = data;
    if (!title)    throw new AppError('Title is required', 400);
    if (!type)     throw new AppError('type is required', 400);
    if (!classId)  throw new AppError('classId is required', 400);
    if (!subjectId)throw new AppError('subjectId is required', 400);
    if (!fileUrl && type !== 'link') throw new AppError('fileUrl is required', 400);

    const doc = await Material.create({
      title: title.trim(),
      description: description?.trim() || '',
      type,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      mimeType: mimeType || null,
      size: size || 0,
      classId,
      subjectId,
      uploadedBy: user._id,
    });

    ActivityService.log({
      action: `Study material uploaded: ${doc.title}`,
      module: 'material',
      performedBy: user._id,
      metadata: { materialId: doc._id, classId, subjectId, type },
    }).catch(() => {});

    return Material.findById(doc._id)
      .populate('classId',   'name code')
      .populate('subjectId', 'name code')
      .populate('uploadedBy','name')
      .lean();
  }

  static async getAll(filters = {}) {
    const query = { isActive: true };
    if (filters.classId   && mongoose.isValidObjectId(filters.classId))   query.classId   = filters.classId;
    if (filters.subjectId && mongoose.isValidObjectId(filters.subjectId)) query.subjectId = filters.subjectId;
    if (filters.type)     query.type = filters.type;

    const page  = Math.max(1, parseInt(filters.page)  || 1);
    const limit = Math.min(100, parseInt(filters.limit) || 20);

    const [docs, total] = await Promise.all([
      Material.find(query)
        .populate('classId',   'name code')
        .populate('subjectId', 'name code')
        .populate('uploadedBy','name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit)
        .lean(),
      Material.countDocuments(query),
    ]);

    return { materials: docs, total, page, limit };
  }

  static async getById(id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid material ID', 400);
    const doc = await Material.findById(id)
      .populate('classId','name code').populate('subjectId','name code').populate('uploadedBy','name').lean();
    if (!doc) throw new AppError('Material not found', 404);
    return doc;
  }

  static async remove(id, user) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid material ID', 400);
    const doc = await Material.findById(id);
    if (!doc) throw new AppError('Material not found', 404);
    if (user.role !== 'admin' && user.role !== 'super_admin' && String(doc.uploadedBy) !== String(user._id)) {
      throw new AppError('You can only delete your own materials', 403);
    }
    doc.isActive = false;
    await doc.save();
    return { deleted: true };
  }
}

module.exports = MaterialService;
