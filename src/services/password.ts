import crypto from "crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

const derive = (password: string, salt: Buffer) => crypto.scryptSync(password, salt, KEY_LENGTH);

export const passwordService = {
  hashPassword(password: string) {
    const salt = crypto.randomBytes(SALT_BYTES);
    const hash = derive(password, salt);
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
  },

  verifyPassword(password: string, encoded: string) {
    const [saltHex, hashHex] = encoded.split(":");
    if (!saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, "hex");
    const stored = Buffer.from(hashHex, "hex");
    const computed = derive(password, salt);

    if (stored.length !== computed.length) {
      return false;
    }

    return crypto.timingSafeEqual(stored, computed);
  }
};
