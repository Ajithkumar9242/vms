const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const ApiResponse = require('./apiResponse');

/**
 * Middleware to check validation results.
 * Must be placed after express-validator check chains.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    return ApiResponse.error(res, messages[0], 400, errors.array());
  }
  next();
};

// ─── Reusable Validation Chains ─────────────────────────────
const mongoIdParam = (field = 'id') =>
  param(field).isMongoId().withMessage(`Invalid ${field} format`);

const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
];

module.exports = { validate, body, param, query, mongoIdParam, paginationQuery };
