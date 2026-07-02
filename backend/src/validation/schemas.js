// ============================================================
// VALIDATION SCHEMAS (zod)
// ============================================================
// Per API rules: "validate request shape with schema validation"
// on every endpoint that accepts a body.
// ============================================================

import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must include at least one letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
  organizationName: z.string().min(2, 'Organization name is required').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Organization name is required').max(100),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must include at least one letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
});

// Small helper so route handlers can do:
//   const result = validate(signupSchema, req.body);
//   if (!result.success) return res.status(400).json({ error: result.error });
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(', ');
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
