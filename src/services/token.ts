import crypto from "crypto";

import { env } from "../config/env";

type AuthTokenPayload = {
  email: string;
  iat: number;
};

const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const signPayload = (payload: string) =>
  crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");

export const tokenService = {
  createToken(payload: AuthTokenPayload) {
    const encodedPayload = encode(JSON.stringify(payload));
    const signature = signPayload(encodedPayload);

    return `${encodedPayload}.${signature}`;
  },

  verifyToken(token: string): AuthTokenPayload | null {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = signPayload(encodedPayload);

    if (signature !== expectedSignature) {
      return null;
    }

    try {
      const payload = JSON.parse(decode(encodedPayload)) as AuthTokenPayload;

      if (!payload.email || !payload.iat) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
};
