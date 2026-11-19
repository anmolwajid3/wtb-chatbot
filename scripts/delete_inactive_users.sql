-- Delete inactive staff accounts.
-- Run: psql "$DATABASE_URL" -f scripts/delete_inactive_users.sql
--
-- A user is inactive when users.is_active is false, or their company
-- status is anything other than active. Super admins are kept.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

DELETE FROM users AS u
WHERE u.role <> 'super_admin'
  AND (
    u.is_active = false
    OR EXISTS (
      SELECT 1
      FROM organizations AS o
      WHERE o.id = u.organization_id
        AND lower(COALESCE(o.status, 'active')) <> 'active'
    )
  );
