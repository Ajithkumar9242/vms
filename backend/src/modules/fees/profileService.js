const mongoose = require('mongoose');
const StudentFeeProfile = require('../../models/StudentFeeProfile');
const FeeComponent = require('../../models/FeeComponent');
const FeeInvoice = require('../../models/FeeInvoice');
const Student = require('../../models/Student');
const AppError = require('../../utils/AppError');
const NotificationService = require('../notification/service');
const ActivityService = require('../activity/service');

/**
 * StudentFeeProfileService — core of the student-wise fee system.
 */
class StudentFeeProfileService {

  // ─── Reusable safe-lookup helpers ────────────────────────────
  //  When academicYearId is absent the query falls back to studentId-only,
  //  returning the most-recently-created profile/invoice for that student.

  /**
   * Find a StudentFeeProfile for the given student.
   * If academicYearId is provided it is included in the query;
   * otherwise the newest profile for the student is returned.
   */
  static async findProfile(studentId, academicYearId) {
    const query = { studentId };
    if (academicYearId) query.academicYearId = academicYearId;
    return StudentFeeProfile.findOne(query).sort({ createdAt: -1 });
  }

  /**
   * Find a FeeInvoice for the given student.
   * Same optional-academicYearId semantics as findProfile.
   */
  static async findInvoice(studentId, academicYearId) {
    const query = { studentId };
    if (academicYearId) query.academicYearId = academicYearId;
    return FeeInvoice.findOne(query).sort({ createdAt: -1 });
  }

  /**
   * Get ALL students in a class with their fee profiles (for spreadsheet view).
   * Returns rows suitable for the assignment grid.
   */
  static async getClassMatrix(classId, academicYearId) {
    if (!classId) throw new AppError('classId is required', 400);

    const SetupService = require('../setup/service');
    const resolvedYearId = academicYearId
      ? await SetupService.resolveAcademicYearId(academicYearId)
      : null;

    // Fetch all active students in this class
    const students = await Student.find({ classId, isActive: true })
      .select('_id name rollNo parentName parentPhone admissionId')
      .populate('admissionId', 'applicationNo')
      .sort({ name: 1 })
      .lean();

    if (!students.length) return { students: [], components: [], profiles: [] };

    // Fetch all active fee components
    const components = await FeeComponent.find({ active: true }).sort({ mandatory: -1, name: 1 }).lean();

    // Fetch existing profiles for these students
    const studentIds = students.map(s => s._id);
    const profileQuery = { studentId: { $in: studentIds } };
    if (resolvedYearId) profileQuery.academicYearId = resolvedYearId;

    const profiles = await StudentFeeProfile.find(profileQuery)
      .populate('selectedComponents.componentId', 'name code amount mandatory')
      .lean();

    const profileMap = {};
    for (const p of profiles) {
      profileMap[p.studentId.toString()] = p;
    }

    // Build matrix rows
    const rows = students.map(student => {
      const profile = profileMap[student._id.toString()] || null;
      const selectedIds = new Set(
        (profile?.selectedComponents || []).map(c =>
          String(c.componentId?._id || c.componentId)
        )
      );

      const componentChecks = {};
      for (const comp of components) {
        const cid = String(comp._id);
        componentChecks[cid] = comp.mandatory || selectedIds.has(cid);
      }

      return {
        studentId: student._id,
        name: student.name,
        rollNo: student.rollNo,
        admissionNo: student.admissionId?.applicationNo || student.rollNo,
        parentName: student.parentName,
        profileId: profile?._id || null,
        locked: profile?.locked || false,
        discounts: profile?.discounts || [],
        grossFee: profile?.grossFee || 0,
        discountAmt: profile?.discountAmt || 0,
        netFee: profile?.netFee || profile?.totalFee || 0,
        installments: profile?.installments || [],
        componentChecks, // { componentId: true/false }
      };
    });

    return { students: rows, components, profiles };
  }

  /**
   * Bulk save student fee profiles for a class.
   * Each item: { studentId, selectedComponentIds[], discounts[] }
   */
  static async bulkSave({ classId, academicYearId, rows, userId }) {
    if (!classId) throw new AppError('classId is required', 400);
    if (!rows || !rows.length) throw new AppError('No rows to save', 400);

    const SetupService = require('../setup/service');
    const resolvedYearId = await SetupService.resolveAcademicYearId(academicYearId);

    // Load all components once
    const allComponents = await FeeComponent.find({ active: true }).lean();
    const compMap = {};
    for (const c of allComponents) compMap[c._id.toString()] = c;

    const results = { saved: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        const { studentId, selectedComponentIds = [], discounts = [] } = row;

        // Check if profile is locked
        const existing = await StudentFeeProfile.findOne({ studentId, academicYearId: resolvedYearId });
        if (existing?.locked) {
          results.skipped++;
          continue;
        }

        // Always include mandatory components
        const mandatoryIds = allComponents.filter(c => c.mandatory).map(c => c._id.toString());
        const finalIds = [...new Set([...mandatoryIds, ...selectedComponentIds.map(String)])];

        const selectedComponents = finalIds.map(id => {
          const comp = compMap[id];
          if (!comp) return null;
          return {
            componentId: comp._id,
            name: comp.name,
            code: comp.code,
            amount: comp.amount,
            mandatory: comp.mandatory,
          };
        }).filter(Boolean);

        const profileData = {
          studentId,
          classId,
          academicYearId: resolvedYearId,
          selectedComponents,
          discounts: discounts || [],
          installments: row.installments || existing?.installments || [],
          updatedBy: userId,
        };

        if (!existing) profileData.createdBy = userId;

        const profile = existing
          ? await StudentFeeProfile.findOneAndUpdate(
            { studentId, academicYearId: resolvedYearId },
            profileData,
            { new: true, runValidators: true }
          )
          : await StudentFeeProfile.create(profileData);

        // Auto-generate or update FeeInvoice
        await ProfileService._upsertInvoice(profile, resolvedYearId, userId);

        results.saved++;
      } catch (err) {
        results.errors.push({ studentId: row.studentId, error: err.message });
      }
    }

    return results;
  }

  /**
   * Get a single student's fee profile with full detail.
   */
  static async getStudentProfile(studentId, academicYearId) {
    const query = { studentId };
    if (academicYearId && mongoose.isValidObjectId(academicYearId)) {
      query.academicYearId = academicYearId;
    }
    const profile = await StudentFeeProfile.findOne(query)
      .populate('studentId', 'name rollNo classId parentName parentPhone')
      .populate('classId', 'name code')
      .populate('academicYearId', 'name')
      .populate('selectedComponents.componentId', 'name code amount mandatory recurringType')
      .populate('discounts.approvedBy', 'name')
      .populate('lockedBy', 'name')
      .lean();
    return profile;
  }

  /**
   * Add a discount to a student's fee profile.
   */
  static async addDiscount(studentId, academicYearId, discountData, userId) {
    const profile = await ProfileService.findProfile(studentId, academicYearId);
    if (!profile) throw new AppError('Student fee profile not found', 404);
    if (profile.locked) throw new AppError('Profile is locked. Unlock first.', 403);

    profile.discounts.push({ ...discountData, approvedBy: userId, appliedAt: new Date() });
    await profile.save();

    // Update linked invoice's discount amount (use profile's stored academicYearId for precision)
    const invoice = await ProfileService.findInvoice(studentId, profile.academicYearId);
    if (invoice) {
      invoice.discountAmount = profile.discountAmt;
      await invoice.save();
    }

    return profile;
  }

  /**
   * Lock a student fee profile (admin only).
   */
  static async lockProfile(studentId, academicYearId, userId) {
    const profile = await ProfileService.findProfile(studentId, academicYearId);
    if (!profile) throw new AppError('Profile not found', 404);
    if (profile.locked) throw new AppError('Profile is already locked', 400);

    profile.locked = true;
    profile.lockedAt = new Date();
    profile.lockedBy = userId;
    await profile.save();

    // Also lock the linked invoice
    const invoice = await ProfileService.findInvoice(studentId, profile.academicYearId);
    if (invoice && !invoice.locked) {
      invoice.locked = true;
      invoice.lockedAt = new Date();
      invoice.lockedBy = userId;
      await invoice.save();
    }

    return profile;
  }

  /**
   * Unlock a student fee profile (super_admin / admin only).
   */
  static async unlockProfile(studentId, academicYearId, userId) {
    const profile = await ProfileService.findProfile(studentId, academicYearId);
    if (!profile) throw new AppError('Profile not found', 404);
    if (!profile.locked) throw new AppError('Profile is not locked', 400);

    profile.locked = false;
    profile.unlockedAt = new Date();
    profile.unlockedBy = userId;
    await profile.save();

    // Also unlock the linked invoice
    const invoice = await ProfileService.findInvoice(studentId, profile.academicYearId);
    if (invoice && invoice.locked) {
      invoice.locked = false;
      invoice.unlockedAt = new Date();
      invoice.unlockedBy = userId;
      await invoice.save();
    }

    return profile;
  }

  /**
   * Upsert FeeInvoice from a StudentFeeProfile.
   * Called after bulk-save.
   */
  static async _upsertInvoice(profile, academicYearId, userId) {
    try {
      const FeesService = require('./service');
      const existingInvoice = await FeeInvoice.findOne({
        studentId: profile.studentId,
        academicYearId,
      });

      if (existingInvoice) {
        if (!existingInvoice.locked) {
          // Sync amounts and profile link first, THEN regenerate schedule
          existingInvoice.totalAmount    = profile.grossFee;
          existingInvoice.discountAmount = profile.discountAmt;
          existingInvoice.feeProfileId   = profile._id;
          await existingInvoice.save();

          // Regenerate schedule from profile.installments — preserves paid history
          await FeesService.regenerateSchedule(existingInvoice._id.toString(), userId);
        }
      } else {
        const student = await Student.findById(profile.studentId).select('classId').lean();
        // generateInvoice now reads profile.installments as source of truth
        await FeesService.generateInvoice({
          studentId:      profile.studentId,
          classId:        student?.classId || profile.classId,
          academicYearId,
        });
      }
    } catch (e) {
      console.error('Invoice upsert failed (non-blocking):', e.message);
    }
  }
}

// Export with alias for internal use
const ProfileService = StudentFeeProfileService;

module.exports = StudentFeeProfileService;
