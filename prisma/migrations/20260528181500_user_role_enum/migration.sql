-- Normalize existing role strings to the new Prisma UserRole enum values.
-- SQLite stores Prisma enums as text, so no table rebuild is required.
UPDATE "User"
SET "role" = CASE
  WHEN LOWER("role") = 'admin' THEN 'ADMIN'
  WHEN LOWER("role") = 'moderator' THEN 'MODERATOR'
  ELSE 'USER'
END;
