import { z } from 'zod';
import { PATENT_CONFIG } from '@/config/constants';

// ============ AUTH SCHEMAS ============

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  solana_wallet_address: z
    .string()
    .min(32, 'Invalid Solana wallet address')
    .max(44, 'Invalid Solana wallet address')
    .regex(/^[1-9A-HJ-NP-Z]{32,44}$/, 'Invalid Solana wallet address format'),
  legal_name: z.string().optional(),
  country: z.string().optional(),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export const loginWalletSchema = z.object({
  wallet_address: z
    .string()
    .min(32, 'Invalid Solana wallet address')
    .max(44, 'Invalid Solana wallet address')
    .regex(/^[1-9A-HJ-NP-Z]{32,44}$/, 'Invalid Solana wallet address format'),
  network: z.string().optional().default('solana'),
});

export type LoginWalletFormData = z.infer<typeof loginWalletSchema>;

export const submitPatentSchema = z.object({
  patent_number: z
    .string()
    .min(PATENT_CONFIG.minPatentNumberLength, 'Patent number is too short')
    .max(PATENT_CONFIG.maxPatentNumberLength, 'Patent number is too long'),
  patent_title: z
    .string()
    .min(PATENT_CONFIG.minTitleLength, 'Title is too short')
    .max(PATENT_CONFIG.maxTitleLength, 'Title is too long'),
  claimed_owner_name: z
    .string()
    .min(PATENT_CONFIG.minOwnerNameLength, 'Owner name is too short')
    .max(PATENT_CONFIG.maxOwnerNameLength, 'Owner name is too long'),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .regex(PATENT_CONFIG.phonePattern, 'Invalid phone format. Use E.164 format (e.g., +12345678901)'),
  description: z
    .string()
    .max(PATENT_CONFIG.maxDescriptionLength, 'Description is too long')
    .optional(),
  jurisdiction: z.enum(['US', 'EP', 'WO']).optional().default('US'),
});

export type SubmitPatentFormData = z.infer<typeof submitPatentSchema>;

export const verifyPatentOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z
    .string()
    .regex(/^\d{6}$/, 'OTP must be 6 digits')
    .transform((val) => val.trim()),
  submission_id: z.string().uuid('Invalid submission ID'),
});

export type VerifyPatentOTPFormData = z.infer<typeof verifyPatentOTPSchema>;

export const otpSendSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  purpose: z.enum([
    'register',
    'login',
    'password_reset',
    'issuer_upgrade',
    'patent_submission',
    'patent_submission_phone',
  ]),
});

export type OTPSendFormData = z.infer<typeof otpSendSchema>;

export const otpVerifySchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  code: z
    .string()
    .regex(/^\d{6}$/, 'OTP must be 6 digits')
    .transform((val) => val.trim()),
  purpose: z.enum(['register', 'login', 'password_reset', 'issuer_upgrade']),
});

export type OTPVerifyFormData = z.infer<typeof otpVerifySchema>;

export const passwordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

// ============ USER SCHEMAS ============

export const profileUpdateSchema = z.object({
  legal_name: z.string().optional(),
  country: z.string().optional(),
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;

export const verificationDocumentsSchema = z.object({
  id_document: z.instanceof(File).refine((file) => file.size > 0, 'ID document is required'),
  selfie: z.instanceof(File).refine((file) => file.size > 0, 'Selfie is required'),
  video: z.instanceof(File).optional(),
  user_address: z
    .string()
    .min(5, 'Address is too short')
    .max(500, 'Address is too long'),
});

export type VerificationDocumentsFormData = z.infer<typeof verificationDocumentsSchema>;

// ============ PATENTS SCHEMAS ============

export const precheckPatentSchema = z.object({
  patent_number: z.string().min(1, 'Patent number is required'),
  country_code: z.enum(['US', 'EP', 'WO']),
  kind_code: z.string().optional(),
  include_analytics: z.boolean().optional().default(false),
});

export type PrecheckPatentFormData = z.infer<typeof precheckPatentSchema>;

// ============ IP CLAIMS SCHEMAS ============

export const reviewClaimSchema = z.object({
  decision: z.enum(['approve', 'reject', 'request_more_data']),
  notes: z.string().optional(),
});

export type ReviewClaimFormData = z.infer<typeof reviewClaimSchema>;

// ============ VALIDATION UTILITIES ============

export function validateForm<T>(schema: z.Schema<T>, data: unknown): { success: boolean; data?: T; errors?: Record<string, string> } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: { general: 'Validation failed' } };
  }
}

export function getFieldError(
  errors: Record<string, string> | undefined,
  fieldName: string
): string | undefined {
  return errors?.[fieldName];
}
