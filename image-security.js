// Image Upload Security - Validates image files before upload

/**
 * Validate image file for security
 * @param {File} file - The file to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file type - only allow image types
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, GIF, and WebP images are allowed' };
  }

  // Check file extension as secondary validation
  const fileName = file.name.toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return { valid: false, error: 'Invalid file type. Only image files are allowed.' };
  }

  // Check file size - limit to 5MB (5 * 1024 * 1024 bytes)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size must be less than 5MB' };
  }

  // Check for suspicious file names (prevent path traversal, etc.)
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'Invalid file name' };
  }

  // Additional check: ensure file name doesn't contain script-like patterns
  if (fileName.includes('<script') || fileName.includes('javascript:') || fileName.includes('onerror=')) {
    return { valid: false, error: 'Invalid file name' };
  }

  return { valid: true, error: null };
}

/**
 * Validate URL for security (for image URLs and ngrok URLs)
 * @param {string} url - The URL to validate
 * @param {string} type - 'image' or 'ngrok'
 * @returns {Object} - { valid: boolean, error: string }
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Basic URL format validation
  try {
    const urlObj = new URL(url);
    
    // Only allow http/https protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Prevent javascript: and data: URLs (except data:image for uploaded images)
    if (url.toLowerCase().startsWith('javascript:') || 
        (url.toLowerCase().startsWith('data:') && !url.toLowerCase().startsWith('data:image/'))) {
      return { valid: false, error: 'Invalid URL scheme' };
    }

    // Check for suspicious patterns
    if (url.includes('<script') || url.includes('javascript:') || url.includes('onerror=')) {
      return { valid: false, error: 'Invalid URL format' };
    }

    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate ngrok URL specifically
 * @param {string} url - The ngrok URL to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
export function validateNgrokUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Basic URL validation
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    return urlValidation;
  }

  try {
    const urlObj = new URL(url);
    
    // Must be HTTPS for production (recommended)
    if (urlObj.protocol !== 'https:') {
      // Allow HTTP for local development, but warn
      console.warn('Ngrok URL should use HTTPS for security');
    }

    // Check if it looks like an ngrok URL (optional, but good to validate)
    const hostname = urlObj.hostname;
    if (!hostname.includes('.ngrok') && !hostname.includes('.ngrok-free') && 
        !hostname.includes('.ngrok.io') && hostname !== 'localhost' && 
        !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      // Not a strict requirement, but log warning
      console.warn('URL does not appear to be an ngrok URL or localhost');
    }

    // Ensure no malicious paths
    if (urlObj.pathname.includes('..') || urlObj.pathname.includes('<script')) {
      return { valid: false, error: 'Invalid URL path' };
    }

    return { valid: true, error: null };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitize image data URL (for base64 encoded images)
 * @param {string} dataUrl - The data URL to sanitize
 * @returns {string|null} - Sanitized data URL or null if invalid
 */
export function sanitizeImageDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return null;
  }

  // Only allow data:image/ URLs
  if (!dataUrl.startsWith('data:image/')) {
    return null;
  }

  // Check for allowed image types in data URL
  const allowedDataImageTypes = ['data:image/jpeg', 'data:image/jpg', 'data:image/png', 'data:image/gif', 'data:image/webp'];
  const isValidType = allowedDataImageTypes.some(type => dataUrl.toLowerCase().startsWith(type.toLowerCase()));
  
  if (!isValidType) {
    return null;
  }

  // Ensure it contains base64 data
  if (!dataUrl.includes('base64,')) {
    return null;
  }

  // Remove any suspicious patterns
  if (dataUrl.includes('<script') || dataUrl.includes('javascript:') || dataUrl.includes('onerror=')) {
    return null;
  }

  return dataUrl;
}

