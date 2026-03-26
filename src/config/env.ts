import dotenv from "dotenv";
import { z } from "zod";

const isVitestRuntime = Boolean(process.env.VITEST);
const envPath = isVitestRuntime ? ".env.test" : ".env";

dotenv.config({ path: envPath });

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
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_REPLY_TO: z.string().optional(),
  OTP_EMAIL_SUBJECT: z.string().default("Your DatLe verification code"),
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

export const env = parsed.data;
