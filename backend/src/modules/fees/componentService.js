const FeeComponent = require('../../models/FeeComponent');
const AppError     = require('../../utils/AppError');

/**
 * FeeComponentService — CRUD for fee component master list.
 */
class FeeComponentService {

  static async create(data, userId) {
    const { name, code, amount, mandatory, recurringType, allowInstallments, active, lateFeeConfig, description } = data;

    // Unique code check
    const exists = await FeeComponent.findOne({ code: code?.toUpperCase() });
    if (exists) throw new AppError(`A fee component with code "${code.toUpperCase()}" already exists`, 409);

    return FeeComponent.create({
      name, code, amount, mandatory, recurringType, allowInstallments, active, lateFeeConfig, description,
      createdBy: userId,
    });
  }

  static async getAll(filters = {}) {
    const query = {};
    if (filters.active !== undefined) query.active = filters.active === 'true' || filters.active === true;
    if (filters.mandatory !== undefined) query.mandatory = filters.mandatory === 'true' || filters.mandatory === true;
    return FeeComponent.find(query).sort({ mandatory: -1, name: 1 });
  }

  static async getById(id) {
    const component = await FeeComponent.findById(id);
    if (!component) throw new AppError('Fee component not found', 404);
    return component;
  }

  static async update(id, data, userId) {
    const component = await FeeComponent.findById(id);
    if (!component) throw new AppError('Fee component not found', 404);

    // If code is changing, check uniqueness
    if (data.code && data.code.toUpperCase() !== component.code) {
      const dup = await FeeComponent.findOne({ code: data.code.toUpperCase(), _id: { $ne: id } });
      if (dup) throw new AppError(`Code "${data.code.toUpperCase()}" already in use`, 409);
    }

    const allowed = ['name','code','amount','mandatory','recurringType','allowInstallments','active','lateFeeConfig','description'];
    for (const key of allowed) {
      if (data[key] !== undefined) component[key] = data[key];
    }

    return component.save();
  }

  static async toggleActive(id) {
    const component = await FeeComponent.findById(id);
    if (!component) throw new AppError('Fee component not found', 404);
    component.active = !component.active;
    return component.save();
  }

  static async remove(id) {
    const component = await FeeComponent.findById(id);
    if (!component) throw new AppError('Fee component not found', 404);
    // Soft delete — just deactivate
    component.active = false;
    return component.save();
  }
}

module.exports = FeeComponentService;
