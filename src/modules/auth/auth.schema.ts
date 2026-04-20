import { z } from "zod";

const phoneSchema = z.string().regex(/^\+?[1-9]\d{7,14}$/, "Valid phone number is required");
const otpChannelSchema = z.enum(["email", "phone"]);

export const requestOtpSchema = z
  .object({
    email: z.string().email("Valid email is required").optional(),
    phone_number: phoneSchema.optional()
  })
  .refine((data) => !!data.email || !!data.phone_number, {
    message: "Provide either an email or a phone number"
  })
  .refine((data) => !(data.email && data.phone_number), {
    message: "Choose either email or phone for OTP delivery, not both"
  });

export const verifyOtpSchema = z
  .object({
    email: z.string().email("Valid email is required").optional(),
    phone_number: phoneSchema.optional(),
    otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
  })
  .refine((data) => !!data.email || !!data.phone_number, {
    message: "Provide either an email or a phone number"
  })
  .refine((data) => !(data.email && data.phone_number), {
    message: "Choose either email or phone for OTP verification, not both"
  });

export const registerAccountSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    phone_number: phoneSchema.optional(),
    otp_channel: otpChannelSchema.default("email"),
    id_number: z.string().min(4, "ID number is required").max(64, "ID number is too long"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
  })
  .refine((data) => (data.otp_channel === "phone" ? !!data.phone_number : true), {
    message: "Phone number is required when using phone OTP",
    path: ["phone_number"]
  });

export const registerBusinessSchema = registerAccountSchema.and(
  z.object({
    company_name: z.string().min(2, "Company name is required").max(120, "Company name is too long")
  })
);

export const loginAccountSchema = z.object({
  identifier: z.string().min(1, "Email or ID number is required"),
  password: z.string().min(1, "Password is required")
});

export const updateAccountRoleSchema = z.object({
  role: z.enum(["USER", "BUSINESS", "ADMIN"]),
  company_id: z.string().min(1).optional()
});
