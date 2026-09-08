-- ============================================================
-- Adds email verification tracking for Users and Drivers.
-- Admins are excluded -- the admins table has no email column
-- (username-based login only).
-- ============================================================

ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE drivers ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;