/**
 * Security utilities and configurations
 */

// Content Security Policy configuration
export const CSP_CONFIG = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'", 
    "'unsafe-inline'", // Required for Vite in development
    "https://lewvnkdganfaavpwakah.supabase.co"
  ],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", "data:", "https:"],
  'font-src': ["'self'", "data:"],
  'connect-src': [
    "'self'",
    "https://lewvnkdganfaavpwakah.supabase.co",
    "wss://lewvnkdganfaavpwakah.supabase.co"
  ],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
}

// Generate CSP header value
export const generateCSPHeader = (): string => {
  return Object.entries(CSP_CONFIG)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
}

// Security headers configuration
export const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .trim()
}

// Validate file types for uploads
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'application/pdf'
] as const

export const validateFileType = (file: File): boolean => {
  return ALLOWED_FILE_TYPES.includes(file.type as any)
}

// Rate limiting configuration (for future implementation)
export const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
}