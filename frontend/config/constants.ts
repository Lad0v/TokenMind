// API Configuration
export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  timeout: 30000, // 30 seconds
};

// Route protection configuration
export const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/'];

export const PROTECTED_ROUTES = {
  INVESTOR: ['/investor/dashboard', '/investor/my-patents', '/investor/upgrade'],
  ISSUER: ['/issuer/dashboard', '/issuer/claims', '/issuer/verify'],
  ADMIN: ['/admin/dashboard', '/admin/patents', '/admin/users'],
};

// OTP Configuration
export const OTP_CONFIG = {
  length: 6,
  resendDelay: 60000, // 60 seconds
  expiryTime: 600000, // 10 minutes
  maxAttempts: 5,
};

// Patent submission configuration
export const PATENT_CONFIG = {
  minPatentNumberLength: 3,
  maxPatentNumberLength: 100,
  minTitleLength: 2,
  maxTitleLength: 255,
  minOwnerNameLength: 2,
  maxOwnerNameLength: 255,
  minDescriptionLength: 0,
  maxDescriptionLength: 5000,
  phonePattern: /^\+?[1-9]\d{1,14}$/, // E.164 format
  jurisdictions: ['US', 'EP', 'WO'] as const,
};

// Verification document configuration
export const VERIFICATION_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFormats: ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'],
  documentTypes: ['id_document', 'selfie', 'video'] as const,
  maxAddressLength: 500,
};

// User roles
export const USER_ROLES = {
  INVESTOR: 'investor',
  ISSUER: 'issuer',
  ADMIN: 'admin',
} as const;

// Claim statuses
export const CLAIM_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PRECHECKED: 'prechecked',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

// Verification statuses
export const VERIFICATION_STATUSES = {
  NOT_STARTED: 'not_started',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  WALLET_NOT_FOUND: 'Wallet not found. Please register first.',
  INVALID_OTP: 'Invalid OTP code.',
  OTP_EXPIRED: 'OTP has expired.',
  OTP_BLOCKED: 'Too many attempts. Please try again later.',
  INVALID_TOKEN: 'Your session has expired. Please login again.',
  UNAUTHORIZED: 'You do not have permission to access this resource.',
  NETWORK_ERROR: 'Network error. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
  REGISTRATION_FAILED: 'Registration failed. Please try again.',
  LOGIN_FAILED: 'Login failed. Please check your wallet address.',
  PATENT_SUBMISSION_FAILED: 'Failed to submit patent.',
  DOCUMENT_UPLOAD_FAILED: 'Failed to upload document.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  REGISTRATION_SUCCESS: 'Registration successful! Please login with your wallet.',
  LOGIN_SUCCESS: 'Login successful!',
  LOGOUT_SUCCESS: 'Logged out successfully.',
  PATENT_SUBMISSION_SUCCESS: 'Patent submitted successfully. Please verify the OTP.',
  PATENT_VERIFIED_SUCCESS: 'Patent verified! Your role has been upgraded to issuer.',
  PROFILE_UPDATED: 'Profile updated successfully.',
  DOCUMENT_UPLOADED: 'Document uploaded successfully.',
  UPGRADE_SUCCESS: 'Successfully upgraded to issuer role.',
} as const;
