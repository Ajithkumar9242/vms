const AuthService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Auth Controller — handles HTTP request/response.
 * Delegates all business logic to AuthService.
 */
class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate user and return JWT token.
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const { user, token } = await AuthService.loginUser(email, password);

      return ApiResponse.success(res, { user, token }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Get the currently authenticated user's profile.
   * Requires: protect middleware.
   */
  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getCurrentUser(req.user._id);

      return ApiResponse.success(res, { user }, 'User profile retrieved');
    } catch (error) {
      next(error);
    }
  }
  /**
   * PATCH /api/auth/change-password
   * Change password for the currently authenticated user.
   * Requires: protect middleware.
   */
  static async changePassword(req, res, next) {
    try {
      const { oldPassword, newPassword } = req.body;
      const result = await AuthService.changePassword(req.user._id, oldPassword, newPassword);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
