// =============================================================================
// Nucleus AI — Auth Input Validation Schemas (Zod)
// =============================================================================
// Central source of truth for validating authentication-related payloads.
// Shared by API route handlers to ensure consistent, strict input validation.
// =============================================================================

import { z } from 'zod';

/** Reusable password policy: min 8 chars, at least one letter and one number. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
    message: 'Password must include at least one letter and one number',
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254, 'Email is too long');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(120, 'Name is too long')
  .optional();

// ---- Signup -----------------------------------------------------------------
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

// ---- Login (used by the legacy /api/auth/login probe route) -----------------
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---- Forgot password --------------------------------------------------------
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// ---- Reset password ---------------------------------------------------------
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required').max(256),
  password: passwordSchema,
});

// ---- Change password --------------------------------------------------------
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: passwordSchema,
});

// ---- Resend verification ----------------------------------------------------
export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// ---- Helper: format the first Zod error for an API response -----------------
export function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid input';
}
