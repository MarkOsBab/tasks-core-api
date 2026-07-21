import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'The email field is required.' })
    .email('The email field must be a valid email address.'),
  password: z.string({ required_error: 'The password field is required.' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'The email field is required.' })
    .email('The email field must be a valid email address.'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'The token field is required.' })
    .min(1, 'The token field is required.'),
  password: z
    .string({ required_error: 'The password field is required.' })
    .min(8, 'The password field must be at least 8 characters.'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
