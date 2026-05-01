const SetupService = require('./service');
const ApiResponse = require('../../utils/apiResponse');

class SetupController {
  static async createAcademicYear(req, res, next) {
    try {
      const year = await SetupService.createAcademicYear(req.body);
      return ApiResponse.created(res, year, 'Academic Year created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateAcademicYear(req, res, next) {
    try {
      const year = await SetupService.updateAcademicYear(req.params.id, req.body);
      return ApiResponse.success(res, year, 'Academic Year updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getAcademicYears(req, res, next) {
    try {
      const years = await SetupService.getAcademicYears();
      return ApiResponse.success(res, years, 'Academic years fetched');
    } catch (error) {
      next(error);
    }
  }

  static async getActiveAcademicYear(req, res, next) {
    try {
      const year = await SetupService.getActiveAcademicYear();
      return ApiResponse.success(res, year, 'Active academic year fetched');
    } catch (error) {
      next(error);
    }
  }

  static async upsertClassConfig(req, res, next) {
    try {
      const config = await SetupService.upsertClassConfig(req.body);
      return ApiResponse.success(res, config, 'Class Config saved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getClassConfigs(req, res, next) {
    try {
      const { academicYearId } = req.params;
      const configs = await SetupService.getClassConfigs(academicYearId);
      return ApiResponse.success(res, configs, 'Class configs fetched');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SetupController;
