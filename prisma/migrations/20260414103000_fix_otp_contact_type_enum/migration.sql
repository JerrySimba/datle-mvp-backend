DO $$
BEGIN
  CREATE TYPE "OtpContactType" AS ENUM ('EMAIL', 'PHONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "auth_otp_codes"
ALTER COLUMN "contact_type" DROP DEFAULT;

ALTER TABLE "auth_otp_codes"
ALTER COLUMN "contact_type" TYPE "OtpContactType"
USING "contact_type"::"OtpContactType";

ALTER TABLE "auth_otp_codes"
ALTER COLUMN "contact_type" SET DEFAULT 'EMAIL'::"OtpContactType";
