const router = require('express').Router();
const multer = require('multer');
const { protect } = require('../../middlewares/auth');
const { uploadToCloudinary } = require('../../utils/fileUpload');
const ApiResponse = require('../../utils/apiResponse');
const rateLimiter = require('../../middlewares/rateLimiter');

// Multer config — memory storage (for Cloudinary stream)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ═══════════════════════════════════════════════════════════
//  PUBLIC UPLOAD (for online admission — no JWT)
// ═══════════════════════════════════════════════════════════
const publicUploadRateLimit = rateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many uploads. Please wait a moment.',
});

/**
 * POST /api/upload/public
 * Upload a single file without authentication (for online admission form).
 * Rate-limited to prevent abuse.
 */
router.post('/public', publicUploadRateLimit, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 'No file provided', 400);
    }

    const result = await uploadToCloudinary(req.file);
    return ApiResponse.created(res, result, 'File uploaded successfully');
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════
//  PROTECTED UPLOAD (requires auth)
// ═══════════════════════════════════════════════════════════
router.use(protect);

/**
 * POST /api/upload
 * Upload a single file. Returns { url, publicId }.
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 'No file provided', 400);
    }

    const result = await uploadToCloudinary(req.file);
    return ApiResponse.created(res, result, 'File uploaded successfully');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
