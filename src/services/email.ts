import { env } from "../config/env";

type OtpEmailResult = {
  provider: "console" | "resend";
};

const hasResendConfig = () => Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);

const resolveProvider = () => {
  if (env.OTP_EMAIL_PROVIDER === "console") {
    return "console" as const;
  }

  if (env.OTP_EMAIL_PROVIDER === "resend") {
    return "resend" as const;
  }

  return hasResendConfig() ? ("resend" as const) : ("console" as const);
};

const sendWithResend = async (email: string, otp: string) => {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("Resend is selected but RESEND_API_KEY or RESEND_FROM_EMAIL is missing.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {}),
      subject: env.OTP_EMAIL_SUBJECT,
      text: `Your DatLe OTP is ${otp}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
      html: `<p>Your DatLe OTP is <strong>${otp}</strong>.</p><p>It expires in ${env.OTP_TTL_MINUTES} minutes.</p>`
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend send failed (${response.status}): ${details}`);
  }
};

export const emailService = {
  async sendOtp(email: string, otp: string): Promise<OtpEmailResult> {
    const provider = resolveProvider();

    if (provider === "console") {
      console.log(`[OTP-CONSOLE] ${email}: ${otp}`);
      return { provider: "console" };
    }

    await sendWithResend(email, otp);
    return { provider: "resend" };
  }
};
