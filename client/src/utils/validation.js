/**
 * Email validation utility
 * Provides comprehensive email validation functions
 */

/**
 * Regular expression for email validation
 * Follows RFC 5322 simplified pattern for practical use
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {object} - { isValid: boolean, error: string | null }
 */
export function validateEmail(email) {
  // Check if email is provided
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  // Trim whitespace
  const trimmedEmail = email.trim();

  // Check minimum length
  if (trimmedEmail.length === 0) {
    return { isValid: false, error: 'Email is required' };
  }

  // Check maximum length (RFC 5321)
  if (trimmedEmail.length > 254) {
    return { isValid: false, error: 'Email is too long (max 254 characters)' };
  }

  // Check basic format
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  // Check domain length
  const [localPart, domain] = trimmedEmail.split('@');
  if (localPart.length > 64) {
    return { isValid: false, error: 'Email local part is too long (max 64 characters)' };
  }

  if (domain.length > 255) {
    return { isValid: false, error: 'Email domain is too long (max 255 characters)' };
  }

  // Check for invalid characters
  if (trimmedEmail.includes('..')) {
    return { isValid: false, error: 'Email cannot contain consecutive dots' };
  }

  if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
    return { isValid: false, error: 'Email cannot start or end with a dot' };
  }

  return { isValid: true, error: null };
}

/**
 * Sanitizes email input by trimming and converting to lowercase
 * @param {string} email - Email to sanitize
 * @returns {string} - Sanitized email
 */
export function sanitizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Combined validation: validates and sanitizes email
 * @param {string} email - Email to validate and sanitize
 * @returns {object} - { isValid: boolean, email: string, error: string | null }
 */
export function validateAndSanitizeEmail(email) {
  const validation = validateEmail(email);
  
  if (!validation.isValid) {
    return { isValid: false, email: '', error: validation.error };
  }

  return {
    isValid: true,
    email: sanitizeEmail(email),
    error: null,
  };
}
