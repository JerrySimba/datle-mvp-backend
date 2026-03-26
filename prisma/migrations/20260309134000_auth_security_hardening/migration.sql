-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('USER', 'BUSINESS', 'ADMIN');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "role" "AccountRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "accounts" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "auth_otp_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_otp_codes_email_key" ON "auth_otp_codes"("email");
