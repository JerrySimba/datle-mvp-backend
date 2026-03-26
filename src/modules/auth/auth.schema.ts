import { z } from "zod";

export const requestOtpSchema = z.object({
  email: z.string().email("Valid email is required")
});

export const verifyOtpSchema = z.object({
  email: z.string().email("Valid email is required"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});

export const registerAccountSchema = z.object({
  email: z.string().email("Valid email is required"),
  id_number: z.string().min(4, "ID number is required").max(64, "ID number is too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});

export const registerBusinessSchema = registerAccountSchema.extend({
  company_name: z.string().min(2, "Company name is required").max(120, "Company name is too long")
});

export const loginAccountSchema = z.object({
  identifier: z.string().min(1, "Email or ID number is required"),
  password: z.string().min(1, "Password is required")
});

export const updateAccountRoleSchema = z.object({
  role: z.enum(["USER", "BUSINESS", "ADMIN"]),
  company_id: z.string().min(1).optional()
});
