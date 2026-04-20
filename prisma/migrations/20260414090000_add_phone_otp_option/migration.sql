ALTER TABLE "accounts"
ADD COLUMN "phone_number" TEXT;

CREATE UNIQUE INDEX "accounts_phone_number_key" ON "accounts"("phone_number");

ALTER TABLE "auth_otp_codes"
RENAME COLUMN "email" TO "contact_value";

ALTER TABLE "auth_otp_codes"
ADD COLUMN "contact_type" TEXT NOT NULL DEFAULT 'EMAIL';

CREATE INDEX "auth_otp_codes_contact_type_idx" ON "auth_otp_codes"("contact_type");
