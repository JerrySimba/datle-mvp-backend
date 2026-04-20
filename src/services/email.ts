import { env } from "../config/env";

type OtpEmailResult = {
  provider: "console" | "resend" | "console_sms" | "twilio";
};

const hasResendConfig = () => Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
const hasTwilioConfig = () =>
  Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID));

const resolveProvider = () => {
  if (env.OTP_EMAIL_PROVIDER === "console") {
    return "console" as const;
  }

  if (env.OTP_EMAIL_PROVIDER === "resend") {
    return "resend" as const;
  }

  return hasResendConfig() ? ("resend" as const) : ("console" as const);
};

const resolveSmsProvider = () => {
  if (env.OTP_SMS_PROVIDER === "console") {
    return "console_sms" as const;
  }

  if (env.OTP_SMS_PROVIDER === "twilio") {
    return "twilio" as const;
  }

  return hasTwilioConfig() ? ("twilio" as const) : ("console_sms" as const);
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

const sendWithTwilioSms = async (phoneNumber: string, otp: string) => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio is selected but TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing.");
  }

  if (!env.TWILIO_FROM_NUMBER && !env.TWILIO_MESSAGING_SERVICE_SID) {
    throw new Error("Twilio is selected but TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID is missing.");
  }

  const body = new URLSearchParams({
    To: phoneNumber,
    Body: `Your DatLe OTP is ${otp}. It expires in ${env.OTP_TTL_MINUTES} minutes.`
  });

  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    body.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  } else if (env.TWILIO_FROM_NUMBER) {
    body.set("From", env.TWILIO_FROM_NUMBER);
  }

  const credentials = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Twilio SMS send failed (${response.status}): ${details}`);
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
  },

  async sendPhoneOtp(phoneNumber: string, otp: string): Promise<OtpEmailResult> {
    const provider = resolveSmsProvider();

    if (provider === "console_sms") {
      console.log(`[OTP-SMS-CONSOLE] ${phoneNumber}: ${otp}`);
      return { provider: "console_sms" };
    }

    await sendWithTwilioSms(phoneNumber, otp);
    return { provider: "twilio" };
  }
};
