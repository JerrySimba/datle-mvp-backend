import dotenv from "dotenv";
import { z } from "zod";

const isVitestRuntime = Boolean(process.env.VITEST);
const envPaths = isVitestRuntime
  ? [".env.test", ".env.test.local"]
  : [".env", ".env.local"];

for (const path of envPaths) {
  dotenv.config({ path, override: true });
}

if (isVitestRuntime && !process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  OTP_EMAIL_PROVIDER: z.enum(["auto", "console", "resend"]).default("auto"),
  OTP_SMS_PROVIDER: z.enum(["auto", "console", "twilio"]).default("auto"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_REPLY_TO: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().regex(/^AC[a-zA-Z0-9]{32}$/, "TWILIO_ACCOUNT_SID must look like AC...").optional().or(z.literal("")),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "TWILIO_FROM_NUMBER must be in E.164 format, for example +2547...")
    .optional()
    .or(z.literal("")),
  TWILIO_MESSAGING_SERVICE_SID: z
    .string()
    .regex(/^MG[a-zA-Z0-9]{32}$/, "TWILIO_MESSAGING_SERVICE_SID must look like MG...")
    .optional()
    .or(z.literal("")),
  OTP_EMAIL_SUBJECT: z.string().default("Your DatLe verification code"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.2"),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  AUTH_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(24 * 60),
  AUTH_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(200)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.OTP_EMAIL_PROVIDER === "resend") {
  const missing: string[] = [];
  if (!parsed.data.RESEND_API_KEY) {
    missing.push("RESEND_API_KEY");
  }
  if (!parsed.data.RESEND_FROM_EMAIL) {
    missing.push("RESEND_FROM_EMAIL");
  }

  if (missing.length > 0) {
    console.error("Invalid environment configuration", {
      resend: [`Missing required variables for resend provider: ${missing.join(", ")}`]
    });
    process.exit(1);
  }
}

if (parsed.data.OTP_SMS_PROVIDER === "twilio") {
  const missing: string[] = [];
  if (!parsed.data.TWILIO_ACCOUNT_SID) {
    missing.push("TWILIO_ACCOUNT_SID");
  }
  if (!parsed.data.TWILIO_AUTH_TOKEN) {
    missing.push("TWILIO_AUTH_TOKEN");
  }
  if (!parsed.data.TWILIO_FROM_NUMBER && !parsed.data.TWILIO_MESSAGING_SERVICE_SID) {
    missing.push("TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID");
  }

  if (missing.length > 0) {
    console.error("Invalid environment configuration", {
      twilio: [`Missing required variables for twilio provider: ${missing.join(", ")}`]
    });
    process.exit(1);
  }
}

export const env = parsed.data;
