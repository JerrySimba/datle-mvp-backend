import { AppError } from "../../middleware/errorHandler";
import { env } from "../../config/env";
import { tokenService } from "../../services/token";
import { emailService } from "../../services/email";

type OtpRecord = {
  otp: string;
  expiresAt: number;
};

class OtpService {
  private store = new Map<string, OtpRecord>();

  async requestOtp(email: string) {
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = Date.now() + env.OTP_TTL_MINUTES * 60 * 1000;
    const normalizedEmail = email.toLowerCase();

    this.store.set(normalizedEmail, { otp, expiresAt });

    try {
      const delivery = await emailService.sendOtp(normalizedEmail, otp);

      return {
        message: "OTP generated",
        expiresInMinutes: env.OTP_TTL_MINUTES,
        delivery: delivery.provider
      };
    } catch (error) {
      this.store.delete(normalizedEmail);
      throw new AppError("Failed to send OTP email", 500);
    }
  }

  verifyOtp(email: string, otp: string) {
    const key = email.toLowerCase();
    const record = this.store.get(key);

    if (!record) {
      throw new AppError("OTP not found. Request a new code.", 401);
    }

    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      throw new AppError("OTP expired. Request a new code.", 401);
    }

    if (record.otp !== otp) {
      throw new AppError("Invalid OTP", 401);
    }

    this.store.delete(key);

    const token = tokenService.createToken({
      email: key,
      iat: Date.now()
    });

    return { token, tokenType: "Bearer" };
  }
}

export const otpService = new OtpService();
