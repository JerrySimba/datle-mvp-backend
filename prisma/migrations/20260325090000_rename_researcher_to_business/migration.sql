DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_value.enumlabel = 'RESEARCHER'
      AND enum_type.typname = 'AccountRole'
  ) THEN
    ALTER TYPE "AccountRole" RENAME VALUE 'RESEARCHER' TO 'BUSINESS';
  END IF;
END $$;
