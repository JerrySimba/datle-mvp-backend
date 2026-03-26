CREATE TABLE "companies" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

ALTER TABLE "accounts" ADD COLUMN "company_id" TEXT;
ALTER TABLE "studies" ADD COLUMN "company_id" TEXT;

ALTER TABLE "accounts"
ADD CONSTRAINT "accounts_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "studies"
ADD CONSTRAINT "studies_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "accounts_company_id_idx" ON "accounts"("company_id");
CREATE INDEX "studies_company_id_idx" ON "studies"("company_id");
