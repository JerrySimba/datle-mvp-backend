import { z } from "zod";

export const requestOtpSchema = z.object({
  email: z.string().email("Valid email is required")
});

export const verifyOtpSchema = z.object({
  email: z.string().email("Valid email is required"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});
