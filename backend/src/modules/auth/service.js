const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Faculty = require('../../models/Faculty');
const Parent = require('../../models/Parent');
const AppError = require('../../utils/AppError');

/**
 * Auth Service — all authentication business logic.
 * Supports multi-role login: admin, faculty, parent.
 */
class AuthService {
  /**
   * Authenticate a user by email + password.
   * Returns user with linked entity if applicable.
   */
  static async loginUser(email, password) {
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account deactivated. Contact admin.', 403);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = AuthService.generateToken(user._id, user.role);

    const userObj = user.toObject();
    delete userObj.password;

    // Attach linked entity for role-based context
    userObj.linkedEntity = await AuthService._getLinkedEntity(user);

    return { user: userObj, token };
  }

  /**
   * Fetch the currently authenticated user's profile with linked entity.
   */
  static async getCurrentUser(userId) {
    const user = await User.findById(userId).select('-password').lean();

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Attach linked entity
    user.linkedEntity = await AuthService._getLinkedEntity(user);

    return user;
  }

  /**
   * Create a user account for a faculty member.
   * @param {Object} faculty — faculty document
   * @param {string} defaultPassword — default password
   * @returns {Object} created user
   */
  static async createFacultyUser(faculty, defaultPassword = 'Vms@1234') {
    // Check if user already exists for this email
    const existing = await User.findOne({ email: faculty.email });
    if (existing) return existing;

    const user = await User.create({
      name: faculty.name,
      email: faculty.email,
      password: defaultPassword,
      role: 'faculty',
      phone: faculty.phone || null,
      referenceId: faculty._id,
    });

    // Link userId back to faculty
    faculty.userId = user._id;
    await faculty.save();

    return user;
  }

  /**
   * Create a user account for a parent.
   * @param {Object} parent — parent document
   * @param {string} defaultPassword — default password
   * @returns {Object} created user
   */
  static async createParentUser(parent, defaultPassword = 'Vms@1234') {
    // Need email for login
    if (!parent.email) return null;

    const existing = await User.findOne({ email: parent.email });
    if (existing) return existing;

    const user = await User.create({
      name: parent.name,
      email: parent.email,
      password: defaultPassword,
      role: 'parent',
      phone: parent.phone || null,
      referenceId: parent._id,
    });

    parent.userId = user._id;
    await parent.save();

    return user;
  }

  /**
   * Get linked entity (faculty or parent) for a user.
   * @private
   */
  static async _getLinkedEntity(user) {
    if (!user.referenceId) return null;

    if (user.role === 'faculty') {
      return Faculty.findById(user.referenceId)
        .populate('subjects', 'name code')
        .populate('assignedClasses', 'name code')
        .lean();
    }

    if (user.role === 'parent') {
      return Parent.findById(user.referenceId)
        .populate({
          path: 'linkedStudents',
          select: 'name rollNo classId',
          populate: { path: 'classId', select: 'name code' },
        })
        .lean();
    }

    return null;
  }

  /**
   * Generate a signed JWT containing user id and role.
   */
  static generateToken(userId, role) {
    return jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }
}

module.exports = AuthService;
