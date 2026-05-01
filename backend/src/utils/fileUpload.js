const AppError = require('./AppError');

/**
 * File Upload Utility.
 * Uses Cloudinary when CLOUDINARY_URL is configured.
 * Falls back to a mock response when no credentials are set.
 *
 * Validates: file type (image/pdf) and size (max 5MB).
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Upload a file to Cloudinary.
 * @param {{ buffer: Buffer, mimetype: string, originalname: string, size: number }} file
 * @returns {{ url: string, publicId: string }}
 */
const uploadToCloudinary = async (file) => {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new AppError(`File type not allowed. Allowed: ${ALLOWED_TYPES.join(', ')}`, 400);
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    throw new AppError('File too large. Maximum size is 5MB', 400);
  }

  // ─── Check if Cloudinary is configured ──────────────────────
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const cloudinary = require('cloudinary').v2;

      // Configure if not done via CLOUDINARY_URL
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'vms-erp',
            resource_type: file.mimetype === 'application/pdf' ? 'raw' : 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      console.error('⚠️ Cloudinary upload failed:', error.message);
      throw new AppError('File upload failed. Please try again.', 500);
    }
  }

  // ─── Fallback: mock response (no Cloudinary configured) ────
  console.warn('⚠️ Cloudinary not configured — returning mock upload URL');
  const mockId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    url: `https://via.placeholder.com/200?text=${encodeURIComponent(file.originalname)}`,
    publicId: mockId,
  };
};

module.exports = { uploadToCloudinary, ALLOWED_TYPES, MAX_SIZE };
