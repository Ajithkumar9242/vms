/**
 * Basic Rate Limiter Middleware
 * In-memory IP-based rate limiting. No external dependencies.
 *
 * Usage:
 *   app.use('/api/auth', rateLimiter({ windowMs: 60000, max: 20 }));
 *   app.use(rateLimiter()); // default: 100 requests per minute
 */
const ApiResponse = require('../utils/apiResponse');

// Store: { ip: { count, resetTime } }
const ipStore = new Map();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipStore.entries()) {
    if (now > data.resetTime) {
      ipStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * @param {Object} options
 * @param {number} options.windowMs - Time window in ms (default: 60000 = 1 min)
 * @param {number} options.max - Max requests per window (default: 100)
 * @param {string} options.message - Error message when limited
 */
const rateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests. Please try again later.',
  } = options;

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!ipStore.has(ip) || now > ipStore.get(ip).resetTime) {
      ipStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const entry = ipStore.get(ip);
    entry.count += 1;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > max) {
      return ApiResponse.error(res, message, 429);
    }

    next();
  };
};

module.exports = rateLimiter;
