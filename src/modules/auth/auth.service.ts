import crypto from "crypto";
import { Prisma } from "@prisma/client";

import { AppError } from "../../middleware/errorHandler";
import { env } from "../../config/env";
import { tokenService } from "../../services/token";
import { emailService } from "../../services/email";
import { passwordService } from "../../services/password";
import { prisma } from "../../services/prisma";
import { companiesService } from "../companies/companies.service";

type AttemptState = {
  count: number;
  resetAt: number;
  lockUntil: number;
};

const attempts = new Map<string, AttemptState>();

const now = () => Date.now();
const lockDurationMs = () => env.AUTH_LOCK_MINUTES * 60 * 1000;
const windowMs = lockDurationMs;
const tokenTtlMs = () => env.AUTH_TOKEN_TTL_MINUTES * 60 * 1000;

const normalizeIdNumber = (idNumber: string) => idNumber.trim().toUpperCase();
const normalizePhoneNumber = (phoneNumber: string) => phoneNumber.trim().replace(/\s+/g, "");
const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");

const getAttemptKey = (action: string, identity: string, ip: string) =>
  `${action}:${identity.trim().toLowerCase()}:${ip || "unknown"}`;

const getAttemptState = (key: string) => {
  const current = attempts.get(key);
  const timestamp = now();
  if (!current || timestamp > current.resetAt) {
    const next = {
      count: 0,
      resetAt: timestamp + windowMs(),
      lockUntil: 0
    };
    attempts.set(key, next);
    return next;
  }

  return current;
};

const assertNotLocked = (key: string) => {
  const state = getAttemptState(key);
  const timestamp = now();
  if (state.lockUntil > timestamp) {
    const retrySeconds = Math.ceil((state.lockUntil - timestamp) / 1000);
    throw new AppError(`Too many attempts. Try again in ${retrySeconds} seconds.`, 429);
  }
};

const recordFailure = (key: string) => {
  const state = getAttemptState(key);
  state.count += 1;
  if (state.count >= env.AUTH_MAX_ATTEMPTS) {
    state.lockUntil = now() + lockDurationMs();
  }
  attempts.set(key, state);
};

const recordSuccess = (key: string) => {
  attempts.delete(key);
};

const consumeOtpRequestQuota = (key: string) => {
  const state = getAttemptState(key);
  assertNotLocked(key);
  state.count += 1;
  if (state.count > env.AUTH_MAX_ATTEMPTS) {
    state.lockUntil = now() + lockDurationMs();
    attempts.set(key, state);
    throw new AppError("Too many OTP requests. Try again later.", 429);
  }
  attempts.set(key, state);
};

const createToken = (params: {
  email: string;
  accountId?: string;
  sessionVersion?: number;
  role?: "USER" | "BUSINESS" | "ADMIN";
}) =>
  tokenService.createToken({
    email: params.email,
    iat: now(),
    exp: now() + tokenTtlMs(),
    accountId: params.accountId,
    sessionVersion: params.sessionVersion,
    role: params.role
  });

const writeAuthAudit = async (params: {
  action: string;
  status: "PASS" | "FAIL";
  email?: string;
  accountId?: string;
  ip?: string;
  details?: Record<string, unknown>;
}) => {
  await prisma.validationLog.create({
    data: {
      entityType: "AUTH",
      entityId: params.accountId || params.email || "unknown",
      checkType: params.action,
      status: params.status,
      details: {
        email: params.email || null,
        account_id: params.accountId || null,
        ip: params.ip || null,
        ...params.details
      }
    }
  });
};

class OtpService {
  private resolveContact(input: { email?: string; phone_number?: string }) {
    if (input.email) {
      return {
        contactType: "EMAIL" as const,
        contactValue: input.email.trim().toLowerCase()
      };
    }

    if (input.phone_number) {
      return {
        contactType: "PHONE" as const,
        contactValue: normalizePhoneNumber(input.phone_number)
      };
    }

    throw new AppError("Provide either an email or a phone number", 422);
  }

  async requestOtp(input: { email?: string; phone_number?: string }, ip: string) {
    const contact = this.resolveContact(input);
    const attemptKey = getAttemptKey("request_otp", contact.contactValue, ip);
    consumeOtpRequestQuota(attemptKey);

    const otp = env.NODE_ENV === "test" ? "123456" : (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = new Date(now() + env.OTP_TTL_MINUTES * 60 * 1000);

    await prisma.authOtpCode.upsert({
      where: { contactValue: contact.contactValue },
      create: {
        contactType: contact.contactType,
        contactValue: contact.contactValue,
        codeHash: hashOtp(otp),
        expiresAt
      },
      update: {
        contactType: contact.contactType,
        codeHash: hashOtp(otp),
        expiresAt
      }
    });

    try {
      const delivery =
        contact.contactType === "EMAIL"
          ? await emailService.sendOtp(contact.contactValue, otp)
          : await emailService.sendPhoneOtp(contact.contactValue, otp);
      await writeAuthAudit({
        action: "request_otp",
        status: "PASS",
        email: contact.contactType === "EMAIL" ? contact.contactValue : undefined,
        ip,
        details: {
          delivery: delivery.provider,
          contact_type: contact.contactType,
          contact_value: contact.contactValue
        }
      });

      return {
        message: "OTP generated",
        expiresInMinutes: env.OTP_TTL_MINUTES,
        delivery: delivery.provider,
        contact_type: contact.contactType.toLowerCase(),
        ...(env.NODE_ENV === "test" ? { test_otp: otp } : {})
      };
    } catch (error) {
      await writeAuthAudit({
        action: "request_otp",
        status: "FAIL",
        email: contact.contactType === "EMAIL" ? contact.contactValue : undefined,
        ip,
        details: {
          reason: `${contact.contactType === "EMAIL" ? "email" : "phone"}_delivery_failed`,
          contact_type: contact.contactType,
          contact_value: contact.contactValue
        }
      });
      throw new AppError(
        contact.contactType === "EMAIL" ? "Failed to send OTP email" : "Failed to send OTP to phone",
        500
      );
    }
  }

  private async consumeOtp(input: { email?: string; phone_number?: string }, otp: string, ip: string) {
    const contact = this.resolveContact(input);
    const attemptKey = getAttemptKey("verify_otp", contact.contactValue, ip);
    assertNotLocked(attemptKey);

    const record = await prisma.authOtpCode.findUnique({
      where: { contactValue: contact.contactValue }
    });

    if (!record) {
      recordFailure(attemptKey);
      await writeAuthAudit({
        action: "verify_otp",
        status: "FAIL",
        email: contact.contactType === "EMAIL" ? contact.contactValue : undefined,
        ip,
        details: { reason: "otp_not_found", contact_type: contact.contactType, contact_value: contact.contactValue }
      });
      throw new AppError("OTP not found. Request a new code.", 401);
    }

    if (now() > record.expiresAt.getTime()) {
      await prisma.authOtpCode.delete({ where: { contactValue: contact.contactValue } });
      recordFailure(attemptKey);
      await writeAuthAudit({
        action: "verify_otp",
        status: "FAIL",
        email: contact.contactType === "EMAIL" ? contact.contactValue : undefined,
        ip,
        details: { reason: "otp_expired", contact_type: contact.contactType, contact_value: contact.contactValue }
      });
      throw new AppError("OTP expired. Request a new code.", 401);
    }

    if (hashOtp(otp) !== record.codeHash) {
      recordFailure(attemptKey);
      await writeAuthAudit({
        action: "verify_otp",
        status: "FAIL",
        email: contact.contactType === "EMAIL" ? contact.contactValue : undefined,
        ip,
        details: { reason: "otp_mismatch", contact_type: contact.contactType, contact_value: contact.contactValue }
      });
      throw new AppError("Invalid OTP", 401);
    }

    await prisma.authOtpCode.delete({ where: { contactValue: contact.contactValue } });
    recordSuccess(attemptKey);
    await writeAuthAudit({
      action: "verify_otp",
      status: "PASS",
      email: contact.contactType === "EMAIL" ? contact.contactValue : undefined,
      ip,
      details: { contact_type: contact.contactType, contact_value: contact.contactValue }
    });
  }

  async verifyOtp(input: { email?: string; phone_number?: string }, otp: string, ip: string) {
    const contact = this.resolveContact(input);
    await this.consumeOtp(input, otp, ip);

    const token = createToken({
      email:
        contact.contactType === "EMAIL" ? contact.contactValue : `phone:${contact.contactValue}`
    });

    return { token, tokenType: "Bearer" };
  }

  async assertValidOtp(input: { email?: string; phone_number?: string }, otp: string, ip: string) {
    await this.consumeOtp(input, otp, ip);
  }
}

export const otpService = new OtpService();

export const accountAuthService = {
  async register(
    input: { email: string; phone_number?: string; otp_channel: "email" | "phone"; id_number: string; password: string; otp: string },
    ip: string
  ) {
    const email = input.email.trim().toLowerCase();
    const phoneNumber = input.phone_number ? normalizePhoneNumber(input.phone_number) : undefined;
    const idNumber = normalizeIdNumber(input.id_number);

    await otpService.assertValidOtp(
      input.otp_channel === "phone" ? { phone_number: phoneNumber } : { email },
      input.otp,
      ip
    );
    const existingAccounts = await prisma.account.count();
    const role = existingAccounts === 0 ? "ADMIN" : "USER";

    try {
      const account = await prisma.account.create({
        data: {
          email,
          phoneNumber,
          idNumber,
          passwordHash: passwordService.hashPassword(input.password),
          role
        }
      });

      const token = createToken({
        email: account.email,
        accountId: account.id,
        sessionVersion: account.sessionVersion,
        role: account.role
      });

      await writeAuthAudit({
        action: "register_account",
        status: "PASS",
        email: account.email,
        accountId: account.id,
        ip
      });

      return {
        token,
        tokenType: "Bearer",
        account: {
          id: account.id,
          email: account.email,
          phone_number: account.phoneNumber,
          id_number: account.idNumber,
          role: account.role,
          company_id: account.companyId
        }
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : "";
        await writeAuthAudit({
          action: "register_account",
          status: "FAIL",
          email,
          ip,
          details: { reason: "duplicate_account", target }
        });
        if (target.includes("email")) {
          throw new AppError("Account with this email already exists", 409);
        }
        if (target.includes("id_number") || target.includes("idNumber")) {
          throw new AppError("Account with this ID number already exists", 409);
        }
        if (target.includes("phone_number") || target.includes("phoneNumber")) {
          throw new AppError("Account with this phone number already exists", 409);
        }
        throw new AppError("Account already exists", 409);
      }

      throw error;
    }
  },

  async registerBusiness(
    input: {
      company_name: string;
      email: string;
      phone_number?: string;
      otp_channel: "email" | "phone";
      id_number: string;
      password: string;
      otp: string;
    },
    ip: string
  ) {
    const email = input.email.trim().toLowerCase();
    const phoneNumber = input.phone_number ? normalizePhoneNumber(input.phone_number) : undefined;
    const idNumber = normalizeIdNumber(input.id_number);

    await otpService.assertValidOtp(
      input.otp_channel === "phone" ? { phone_number: phoneNumber } : { email },
      input.otp,
      ip
    );

    try {
      const result = await prisma.$transaction(async (tx) => {
        const company = await companiesService.create(input.company_name, tx);
        const account = await tx.account.create({
          data: {
            email,
            phoneNumber,
            idNumber,
            passwordHash: passwordService.hashPassword(input.password),
            role: "BUSINESS",
            companyId: company.id
          },
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        return { company, account };
      });

      const token = createToken({
        email: result.account.email,
        accountId: result.account.id,
        sessionVersion: result.account.sessionVersion,
        role: result.account.role
      });

      await writeAuthAudit({
        action: "register_business_account",
        status: "PASS",
        email: result.account.email,
        accountId: result.account.id,
        ip,
        details: {
          company_id: result.company.id,
          company_name: result.company.name
        }
      });

      return {
        token,
        tokenType: "Bearer" as const,
        account: {
          id: result.account.id,
          email: result.account.email,
          phone_number: result.account.phoneNumber,
          id_number: result.account.idNumber,
          role: result.account.role,
          company_id: result.account.companyId,
          company_name: result.account.company?.name || null
        },
        company: {
          id: result.company.id,
          name: result.company.name,
          slug: result.company.slug
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        await writeAuthAudit({
          action: "register_business_account",
          status: "FAIL",
          email,
          ip,
          details: { reason: error.message }
        });
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : "";
        await writeAuthAudit({
          action: "register_business_account",
          status: "FAIL",
          email,
          ip,
          details: { reason: "duplicate_business_account", target }
        });
        if (target.includes("email")) {
          throw new AppError("Account with this email already exists", 409);
        }
        if (target.includes("id_number") || target.includes("idNumber")) {
          throw new AppError("Account with this ID number already exists", 409);
        }
        if (target.includes("phone_number") || target.includes("phoneNumber")) {
          throw new AppError("Account with this phone number already exists", 409);
        }
        if (target.includes("name")) {
          throw new AppError("Company with this name already exists", 409);
        }
        throw new AppError("Business account already exists", 409);
      }

      throw error;
    }
  },

  async login(input: { identifier: string; password: string }, ip: string) {
    const identifier = input.identifier.trim();
    const attemptKey = getAttemptKey("login", identifier, ip);
    assertNotLocked(attemptKey);

    const email = identifier.toLowerCase();
    const idNumber = normalizeIdNumber(identifier);

    const account = await prisma.account.findFirst({
      where: {
        OR: [{ email }, { idNumber }]
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!account || !passwordService.verifyPassword(input.password, account.passwordHash)) {
      recordFailure(attemptKey);
      await writeAuthAudit({
        action: "login_account",
        status: "FAIL",
        email,
        ip,
        details: { reason: "invalid_credentials" }
      });
      throw new AppError("Invalid credentials", 401);
    }

    recordSuccess(attemptKey);

    const token = createToken({
      email: account.email,
      accountId: account.id,
      sessionVersion: account.sessionVersion,
      role: account.role
    });

    await writeAuthAudit({
      action: "login_account",
      status: "PASS",
      email: account.email,
      accountId: account.id,
      ip
    });

    return {
      token,
      tokenType: "Bearer",
      account: {
        id: account.id,
        email: account.email,
        phone_number: account.phoneNumber,
        id_number: account.idNumber,
        role: account.role,
        company_id: account.companyId,
        company_name: account.company?.name || null
      }
    };
  },

  async logout(accountId: string, ip: string) {
    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        sessionVersion: {
          increment: 1
        }
      }
    });

    await writeAuthAudit({
      action: "logout_account",
      status: "PASS",
      email: account.email,
      accountId,
      ip
    });
  },

  async updateRole(
    accountId: string,
    role: "USER" | "BUSINESS" | "ADMIN",
    actor: { accountId: string; email?: string },
    companyId?: string
  ) {
    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        role,
        ...(companyId !== undefined ? { companyId } : {})
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    await writeAuthAudit({
      action: "update_account_role",
      status: "PASS",
      email: account.email,
      accountId: account.id,
      details: {
        role,
        company_id: account.companyId || null,
        company_name: account.company?.name || null,
        actor_account_id: actor.accountId,
        actor_email: actor.email || null
      }
    });

    return {
      id: account.id,
      email: account.email,
      phone_number: account.phoneNumber,
      id_number: account.idNumber,
      role: account.role,
      company_id: account.companyId,
      company_name: account.company?.name || null
    };
  },

  async listAccounts() {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        idNumber: true,
        role: true,
        companyId: true,
        company: {
          select: {
            name: true
          }
        },
        createdAt: true
      }
    });

    return accounts.map((account) => ({
      id: account.id,
      email: account.email,
      phone_number: account.phoneNumber,
      id_number: account.idNumber,
      role: account.role,
      company_id: account.companyId,
      company_name: account.company?.name || null,
      created_at: account.createdAt
    }));
  }
};
